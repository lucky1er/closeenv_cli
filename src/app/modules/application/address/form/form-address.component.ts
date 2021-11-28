import { Component, OnInit, Input, Output, EventEmitter, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { NgbModal, ModalDismissReasons, NgbModalOptions } from '@ng-bootstrap/ng-bootstrap';

import { Address } from 'src/app/model/address';
import { LocationService, keySuggestedAddressProperties } from 'src/app/modules/general/service/location.service';
import { AuthService } from 'src/app/modules/general/service/auth.service';
import { ApiHttpService } from 'src/app/modules/general/service/api.http.service';

const keyEnsureErrorDisplay = 'ensure-error-display';

@Component({
  selector: 'app-form-address',
  templateUrl: './form-address.component.html',
  styleUrls: ['./form-address.component.css']
})
export class FormAddressComponent implements OnInit {

  @Input() address: Address;
  @Input() isTheOnlyOne: boolean;
  @Input() currentLangCode: string;
  @Output() addressValidated = new EventEmitter<Address>();
  @Output() closeWithoutValidation = new EventEmitter<boolean>();
  @Output() closeAfterRemoval = new EventEmitter<boolean>();

  unchanged = true;
  requesting = false;
  warningMessage = '';
  showWarningMessage = false;
  modalCloseResult: string;
  confirmModalOptions: NgbModalOptions;
  initialAddressString: string;
  searchLocation: any = {
    type: 'amenity', // 'postcode' | 'street' | 'amenity'
    skipIcons: true,
    skipDetails: true,
    biasByCountryCode: null, // ['ca', 'es', 'fr']
  };

  /**
   * La saisie d'adresse s'appuie sur https://www.geoapify.com/address-autocomplete
   * voir aussi https://apidocs.geoapify.com/docs/geocoding/address-autocomplete/#autocomplete
   * et encore https://github.com/geoapify/angular-geocoder-autocomplete
   */

  constructor(
    private locationService: LocationService,
    private apiHttpService: ApiHttpService,
    private authService: AuthService,
    private modalService: NgbModal,
    @Inject(PLATFORM_ID) private platformId: object) {
    if (isPlatformBrowser(platformId)) {
      this.confirmModalOptions = {
        backdrop: 'static',
        backdropClass: 'customBackdrop'
      };
    }
  }

  ngOnInit(): void {
    this.initialAddressString = '';
    if (this.isAddressIdentified()) {
      if (!this.address.latitude || !this.address.longitude) {
        this.warningMessage = 'Member.address.form.invalid.geolocation';
        this.showWarningMessage = true;
      }
      this.initialAddressString = Address.getStandardizedAddressString(this.address);
    }
    const user = this.authService.userConnected;
    if (user) {
      this.searchLocation.biasByCountryCode = [user.countryCode];
    }
  }

  refreshAddressForm(selectedSuggestion: any): void {
    if (selectedSuggestion.hasOwnProperty(keySuggestedAddressProperties) && selectedSuggestion[keySuggestedAddressProperties]
      && typeof selectedSuggestion[keySuggestedAddressProperties] === 'object') {
      this.locationService.addressMappingFromSuggestion(this.address, selectedSuggestion[keySuggestedAddressProperties]);
      this.unchanged = false;
    }
  }

  isAddressIdentified(): boolean {
    return (typeof this.address !== 'undefined' && typeof this.address.id === 'number' && this.address.id > 0);
  }

  isAddressEditable(): boolean {
    return (!this.address.shop || this.address.shopValidated);
  }

  hasShopMessages(): boolean {
    return (this.address.msgsCount && this.address.msgsCount > 0);
  }

  hasLookingForItems(): boolean {
    return (this.address.lfiCount && this.address.lfiCount > 0);
  }

  getTextSearchInputPlaceholder(): string {
    // return this.address.nbLinkedPlaces ? 'Member.address.form.search.disable.address.used' : 'Member.address.form.search.placeholder';
    return this.isAddressEditable() 
      ? 'Member.address.form.search.placeholder'
      : 'Member.address.form.search.disable.address.shop.not.validated';
  }

  backToParent(): void {
    this.closeWithoutValidation.emit(true);
  }

  invalidAddress(): boolean {
    // controle surface validité
    return (!this.address.latitude || !this.address.longitude || this.address.addressLabel === '');
  }

  saveAddress(): void {
    if (this.invalidAddress()) {
      this.warningMessage = 'Member.address.form.invalid.text';
      this.showWarningMessage = true;
      return;
    }

    if (this.isAddressIdentified()) {
      this.saveAddressPre();
    } else {
      this.saveAddressNew();
    }
  }

  saveAddressNew(): void {
    // save a new address
    this.requesting = true;

    this.apiHttpService.postAddress(this.address)
      .subscribe((savedAddress) => {
        // console.log('[BRANCHEMENT-API] FormAddressComponent - postAddress - 2 ', savedAddress);
        // this.saveCityFromAddress(this.address);
        // gestion retour vers le composant parent (MemberComponent)
        this.addressValidated.emit(savedAddress);
        this.requesting = false;
      }, (error) => {
        this.requesting = false;
        // afficher l'erreur sur la page du form
        console.warn('[BRANCHEMENT-API] FormAddressComponent - postAddress - 9 ', error);
        this.warningMessage = error.errorMessage;
        this.showWarningMessage = true;
        of(keyEnsureErrorDisplay).pipe(delay(2500)).subscribe(value => {
          this.authService.checkTokenExpiration(error, 1000, true);
        });
      }, () => {
        // fin du subscribe
      });
    //
  }

  saveAddressPre(): void {
    // save a preexisting address
    this.requesting = true;

    this.apiHttpService.putAddress(this.address)
      .subscribe((savedAddress) => {
        const finalAddressString = Address.getStandardizedAddressString(savedAddress);
        if (finalAddressString !== this.initialAddressString) {
          if (savedAddress.nbLinkedPlaces) {
            // supprimer les places enregistrées autour de l'adresse
            this.apiHttpService.deleteLinkedPlaces(this.address.id)
              .subscribe((result) => {}, (error) => { console.warn('deleteLinkedPlaces - 9 ', error); });
          }
          if (savedAddress.shopValidated) {
            //const placesToSave = [];
            //placesToSave.push(this.myShop);
            const placeId = this.apiHttpService.getIdFromIri(savedAddress.shop);
            if (typeof placeId === 'string' && placeId.trim() !== '') {
              this.apiHttpService.patchPlace(placeId, {address: finalAddressString})
                .subscribe((patchedPlace) => {
                    // console.log('[DEBUG] contrôler la MAJ de l\'adresse ', patchedPlace);
                  }
                  , (error) => {
                    console.warn('patchPlace - 9 ', error);
                });
            }
          }
        }
        // console.log('[BRANCHEMENT-API] FormAddressComponent - putAddress - 2 ', savedAddress);
        // this.saveCityFromAddress(this.address);
        // gestion retour vers le composant parent (MemberComponent)
        this.addressValidated.emit(savedAddress);
        this.requesting = false;
      }, (error) => {
        this.requesting = false;
        // afficher l'erreur sur la page du form
        console.warn('[BRANCHEMENT-API] FormAddressComponent - putAddress - 9 ', error);
        this.warningMessage = error.errorMessage;
        this.showWarningMessage = true;
        of(keyEnsureErrorDisplay).pipe(delay(2500)).subscribe(value => {
          this.authService.checkTokenExpiration(error, 1000, true);
        });
      });
    //
  }

  // from https://www.freakyjolly.com/angular-bootstrap-modal-tutorial-by-example/
  openConfirmModal(content) {
    this.modalService.open(content, this.confirmModalOptions).result.then((result) => {
      this.modalCloseResult = `Closed with: ${result}`;
      // console.log('[MODAL]  then() ', this.modalCloseResult);
      if (result === 'confirm') {
        this.removeAddress();
      }
    }, (reason) => {
      this.modalCloseResult = `Dismissed ${this.getDismissReason(reason)}`;
      // console.log('[MODAL]  dismiss ', this.modalCloseResult);
    });
  }

  private getDismissReason(reason: any): string {
    if (reason === ModalDismissReasons.ESC) {
      return 'by pressing ESC';
    } else if (reason === ModalDismissReasons.BACKDROP_CLICK) {
      return 'by clicking on a backdrop';
    } else {
      return  `with: ${reason}`;
    }
  }

  removeAddress(): void {
    this.requesting = true;

    this.apiHttpService.deleteAddress(this.address)
      .subscribe((result) => {
        // console.log('[BRANCHEMENT-API] FormAddressComponent - deleteAddress - 1 ', result);
        this.requesting = false;
        // gestion retour vers le composant parent (MemberComponent)
        this.closeAfterRemoval.emit(true);

      }, (error) => {
        this.requesting = false;
        // afficher l'erreur sur la page du form
        console.warn('[BRANCHEMENT-API] FormAddressComponent - deleteAddress - 9 ', error);
        this.warningMessage = error.errorMessage;
        this.showWarningMessage = true;
        of(keyEnsureErrorDisplay).pipe(delay(2500)).subscribe(value => {
          this.authService.checkTokenExpiration(error, 1000, true);
        });
      }, () => {
        // fin du subscribe
      });
    //
  }

}
