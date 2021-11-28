import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { delay } from 'rxjs/operators';
import cloneDeep from 'lodash-es/cloneDeep';

import { ApiHttpService } from 'src/app/modules/general/service/api.http.service';
import { AuthService } from 'src/app/modules/general/service/auth.service';
import { Address } from 'src/app/model/address';
import { Place } from 'src/app/model/place';

const keyEnsureErrorDisplay = 'ensure-error-display';
const radiusSearchMax = 250;
const keyCodeProperty = 'code';
const keyLabelProperty = 'label';
const placeApiGen = '/api/places/';

@Component({
  selector: 'app-form-shop',
  templateUrl: './form-shop.component.html',
  styleUrls: ['./form-shop.component.css']
})
export class FormShopComponent implements OnInit {

  @Input() address: Address;
  @Input() optionCategories: any[];
  @Output() shopValidated = new EventEmitter<any>(); // <Address>();
  @Output() closeWithoutValidation = new EventEmitter<boolean>();
  @Output() closeAfterRemoval = new EventEmitter<boolean>();

  myShop: Place;
  unchanged = true;
  requesting = false;
  dataLoading = false;
  warningMessage = '';
  showWarningMessage = false;
  optionPlacesLoading = false;
  optionPlaces: any[];
  iriRoot: string;

  constructor(
    private translateService: TranslateService,
    private apiHttpService: ApiHttpService,
    private authService: AuthService) {
    this.myShop = null;
    this.iriRoot = '';
    this.optionPlaces = [];
  }

  ngOnInit(): void {
    if (this.address) {
      this.shopInit();
    }
  }

  getShopStdAddress(): string {
    return Address.getStandardizedAddressString(this.address);
  }

  shopInit(): void {
    this.iriRoot = this.apiHttpService.getIriRootFromUserIri(this.address.user);
    const shopStdAddress = this.getShopStdAddress();
    // console.log('[DEBUG] FormShopComponent OnInit - 1 ', shopStdAddress);

    this.optionPlacesLoading = true;
    const coordsAddress = { latitude: this.address.latitude, longitude: this.address.longitude };
    this.apiHttpService.getClosePlacesFromCoords(coordsAddress, radiusSearchMax)
      .subscribe((places) => {
        // filtrer pour ne garder que les places correspondant à l'adresse exacte
        this.optionPlaces = places.filter((item: Place) => {
          return Place.normalizedStringsEquality(item.address, shopStdAddress);
        });
        // console.log('[DEBUG] FormShopComponent OnInit - 2 ', this.optionPlaces);
      }, (error) => {
        // console.warn('[BRANCHEMENT-API] FormShopComponent OnInit - 9 ', error);
        this.warningMessage = error.errorMessage;
        this.showWarningMessage = true;
        of(keyEnsureErrorDisplay).pipe(delay(2500)).subscribe(value => {
          this.authService.checkTokenExpiration(error, 1000, true);
        });
      }, () => {
        // fin du subscribe
        this.optionPlacesLoading = false;
      });

    // console.log('[DEBUG] FormShopComponent OnInit - 4 ', this.address.shop);
    if (this.address.shop) {
      this.dataLoading = true;
      // appel API pour récupérer le shop et initialiser this.myShop...
      // this.address.shop contient l'IRI du shop (genre '/edsa-api-closeenv/api/places/494')
      // const apiGetPlace = this.address.shop.substring(this.address.shop.indexOf(placeApiGen));
      // console.log('[DEBUG] FormShopComponent OnInit - 5 ', apiGetPlace);
      this.apiHttpService.getShopPlace(this.address.id)
        .subscribe((place) => {
          this.myShop = place;
          this.dataLoading = false;
        }, (error) => {
          this.dataLoading = false;
          // console.warn('[BRANCHEMENT-API] FormShopComponent OnInit - 9 ', error);
          this.warningMessage = error.errorMessage;
          this.showWarningMessage = true;
          of(keyEnsureErrorDisplay).pipe(delay(2500)).subscribe(value => {
            this.authService.checkTokenExpiration(error, 1000, true);
          });
        });
    } else {
      // instancier le shop (de type Place)
      this.resetShop(shopStdAddress);
    }
  }

  resetShop(address: string): void {
    // (ré)initialiser le shop (de type Place)
    this.myShop = new Place(null, '', '', address, +this.address.latitude, +this.address.longitude, null, null, 0, [], [], true);
  }

  shopIsRegistered(): boolean {
    return (this.address.shop && this.address.shop.trim() !== '');
  }

  getAddTitleItemText(): string {
    const titleAddText = this.translateService.instant('Member.vicinity.form.title.addItem.text');
    return titleAddText;
  }

  selectPlace(itemPlace: Place): void {
    if (typeof itemPlace === 'object' && typeof itemPlace.address === 'string') {
      this.myShop = cloneDeep(itemPlace); // object deep copy (with lodash's method)
    }
    this.unchanged = false;
  }

  shopReset(): void {
    this.resetShop(this.getShopStdAddress());
    // console.log('[DEBUG] FormShopComponent shopReset() ', this.myShop);
  }

  getAddContactItemText(): string {
    const contactAddText = this.translateService.instant('Member.vicinity.form.contacts.addItem.text');
    return contactAddText;
  }

  isCategorySelected(a: any, b: any): boolean {
    // The first argument is a value from an option (within this.optionCategories).
    // The second is a value from the selection model (this.place.categories).  -- (this.taggedCategories)
    return (a.code === b);
  }

  backToParent(): void {
    this.closeWithoutValidation.emit(true);
  }


  invalidShop(): boolean {
    // controle surface validité de this.address.shop

    /*--{ "title": "Ma petite entreprise" }--*/
    // title obligatoire
    // console.log('[DEBUG] check title during invalidShop() function  ', this.myShop.title);
    if (!this.myShop.title || (typeof this.myShop.title === 'string' && this.myShop.title.trim() === '') /*||
      (typeof this.myShop.title === 'object' && typeof this.myShop.title === )*/ ) {
      this.warningMessage = 'Member.vicinity.form.invalid.title.required';
      return true;
    }
    // au moins une catégorie doit être sélectionnée
    if (!this.myShop.categories || !this.myShop.categories.length) {
      this.warningMessage = 'Member.vicinity.form.invalid.categories.required';
      return true;
    }
    // au moins un contact doit être renseigné
    if (!this.myShop.contacts || !this.myShop.contacts.length) {
      this.warningMessage = 'Member.vicinity.form.invalid.contacts.required';
      return true;
    }

    return false;
  }

  isSaveShopAllowed(): boolean {
    return !this.apiHttpService.isOffline() && !this.unchanged;
  }

  saveShop(): void {
    if (!this.isSaveShopAllowed()) {
      return;
    }

    if (this.invalidShop()) {
      this.showWarningMessage = true;
      return;
    }

    /* retraiter les valeurs des champs ng-select */
    // mise en forme standard des contacts
    let isObject = null;
    let itemObjectFound = false;
    let newPlaceContacts = [];
    for (let contactItem of this.myShop.contacts) {
      isObject = contactItem.hasOwnProperty(keyLabelProperty);
      // chaque item doit être une string (pas un objet)
      newPlaceContacts.push(isObject ? contactItem[keyLabelProperty] : contactItem);
      if (isObject) {
        itemObjectFound = true;
      }
    }
    if (itemObjectFound) {
      this.myShop.contacts = newPlaceContacts;
      // console.log('[DEBUG] check contacts at the end of the FormShopComponent ', this.myShop.contacts);
    }
    // mise en forme standard des catégories
    itemObjectFound = false;
    let newPlaceCategories = [];
    for (let categItem of this.myShop.categories) {
      isObject = categItem.hasOwnProperty(keyCodeProperty);
      // chaque item doit être une string (pas un objet)
      newPlaceCategories.push(isObject ? categItem[keyCodeProperty] : categItem);
      if (isObject) {
        itemObjectFound = true;
      }
    }
    if (itemObjectFound) {
      this.myShop.categories = newPlaceCategories;
      // console.log('[DEBUG] check categories at the end of the FormShopComponent ', this.myShop.categories);
    }

    // en vue création de la relation PlaceAddress
    this.myShop.userInitiative = true; // sinon toute customisation de Categories/Contacts impacterait l'entité back Place
    this.myShop.orderInList = 1;
    this.myShop.distance = 0;
    // if (this.address.nbLinkedPlaces) {} else { this.myShop.orderInList = -1; /* sans création de la relation PlaceAddress */ }
    const idShopBeforeSave = this.myShop.id;

    // appel api custom post places
    this.requesting = true;
    const placesToSave = [];
    placesToSave.push(this.myShop);
    this.apiHttpService.postLinkedPlaces(this.address.id, placesToSave)
      .subscribe((savedPlaces: Place[]) => {
        // console.log('[DEBUG] FormShopComponent - postLinkedPlaces ', savedPlaces);
        if (savedPlaces.length === 1 && savedPlaces[0].id !== idShopBeforeSave) {
          // reconstituer l'IRI de la nouvelle place pour l'assigner à this.address.shop et sauver ce changement
          this.saveAddressWithNewShop(`${this.iriRoot}${placeApiGen}${savedPlaces[0].id}`);
        } else {
          this.shopValidated.emit({address: this.address});
          this.requesting = false;
        }
      }, (error) => {
        this.requesting = false;
        // afficher l'erreur sur la page du form
        console.warn('[BRANCHEMENT-API] FormShopComponent - postLinkedPlaces - 9 ', error);
        this.warningMessage = error.errorMessage;
        this.showWarningMessage = true;
        of(keyEnsureErrorDisplay).pipe(delay(2500)).subscribe(value => {
          this.authService.checkTokenExpiration(error, 1000, true);
        });
      });
  }


  saveAddressWithNewShop(iriNewShop: string): void {
    this.address.shop = iriNewShop;
    // save address with a new shop
    this.apiHttpService.putAddress(this.address)
      .subscribe((savedAddress) => {
        // console.log('[BRANCHEMENT-API] FormShopComponent - putAddress - 2 ', savedAddress);
        if (iriNewShop) {
          this.apiHttpService.checkShopPlace(this.address.id)
          .subscribe((result) => {
            if (result.validated) {
              savedAddress.shopValidated = true;
            }
            // gestion retour vers le composant parent
            this.shopValidated.emit({address: savedAddress, confirmStatus: result});
            this.requesting = false;
          }, (error) => {
            // console.warn('[API] FormShopComponent checkShopPlace() - 9 ', error);
            this.warningMessage = error.errorMessage;
            this.showWarningMessage = true;
            of(keyEnsureErrorDisplay).pipe(delay(2500)).subscribe(value => {
              this.authService.checkTokenExpiration(error, 1000, true);
            });
          });
        } else {
          this.apiHttpService.cleanShopPlace(this.address.id)
          .subscribe((result) => {}, (error) => {
            console.warn('[API] FormShopComponent cleanShopPlace() - 9 ', error);
            of(keyEnsureErrorDisplay).pipe(delay(2500)).subscribe(value => {
              this.authService.checkTokenExpiration(error, 1000, true);
            });
          });
          savedAddress.shopValidated = false;
          // gestion retour vers le composant parent
          this.shopValidated.emit({address: savedAddress});
          this.requesting = false;
        }
      }, (error) => {
        this.requesting = false;
        // afficher l'erreur sur la page du form
        console.warn('[BRANCHEMENT-API] FormShopComponent - putAddress - 9 ', error);
        this.warningMessage = error.errorMessage;
        this.showWarningMessage = true;
        of(keyEnsureErrorDisplay).pipe(delay(2500)).subscribe(value => {
          this.authService.checkTokenExpiration(error, 1000, true);
        });
      });
  }

  isRemoveShopAllowed(): boolean {
    return !this.apiHttpService.isOffline() && this.shopIsRegistered();
  }

  removeShop(): void {
    if (!this.isRemoveShopAllowed()) {
      return;
    }

    this.requesting = true;
    this.saveAddressWithNewShop(null);
  }
}
