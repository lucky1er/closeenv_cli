import { Component, OnInit, ViewChildren, QueryList, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { fromEvent, merge, of } from 'rxjs';
import { delay, debounceTime } from 'rxjs/operators';
import cloneDeep from 'lodash-es/cloneDeep';

import { AuthService } from '../../general/service/auth.service';
import { ApiHttpService } from '../../general/service/api.http.service';
import { AppConfigService } from 'src/app/app.config.service';
import { MapComponentService } from 'src/app/modules/general/map/map.component.service';
import { AddOnTranslationService } from '../../general/service/addOn.translation.service';
import { User } from '../../../model/user';
import { Address } from 'src/app/model/address';
import { assoCategoryCode } from 'src/app/model/place';
import { Category } from 'src/app/model/category';

const nbMaxAddresses = 5;
const dataAttrIdPrefix = 'i-';
const keyEventDoubleClick = 'dblclick';
const keyEnsureErrorDisplay = 'ensure-error-display';
const keyWaitForDomAvailable = 'ensure-dom-availability';
const keyOptionalConfirmStatus = 'confirmStatus';
const keyConfirmStatusValidated = 'validated';
const keyConfirmStatusMessage = 'message';
const keyConfirmStatusEmail = 'email';
const keyConfirmStatusSentRequests = 'sentRequestsNumber';

@Component({
  selector: 'app-address',
  templateUrl: './address.component.html',
  styleUrls: ['./address.component.css']
})
export class AddressComponent implements OnInit {

  // Accessing multiple native DOM elements using QueryList
  @ViewChildren('itemAddress') listItems: QueryList<ElementRef>;

  userConnected: User = null;
  startingPoint: any = null;
  userAddresses: Address[];
  addressToForm: Address;
  addressToShop: Address;
  selectedAddressId = 0;
  loading = true;
  warningMessage = '';
  showWarningMessage = false;
  successMessage = '';
  showSuccessMessage = false;
  showMessagesList = false;
  showShopForm = false;
  showAddressForm = false;
  showAddressList = true;
  showLookingForsList = false;
  baseCategories: Category[] = null;

  constructor(private router: Router,
    private authService: AuthService,
    private apiHttpService: ApiHttpService,
    private mapService: MapComponentService,
    private configService: AppConfigService,
    public addonTranslator: AddOnTranslationService) { }

  ngOnInit(): void {
    if (!this.authService.activeUserSubscription) {
      this.router.navigate(['/']);
    } else {
      this.userConnected = this.authService.userConnected;
      if (this.userConnected) {
        this.startingPoint = { latitude: this.userConnected.latitude, longitude: this.userConnected.longitude };
      }

      this.apiHttpService.connectivityChecking()
      .subscribe(connectivityResult => {
        // online or offline, go on...
        this.getAddresses();

        this.apiHttpService.getBaseCategories()
          .subscribe((basedCategories: Category[]) => {
            this.baseCategories = basedCategories;
          }, (error) => {
            this.warningMessage = error.errorMessage;
            this.showWarningMessage = true;
            of(keyEnsureErrorDisplay).pipe(delay(2500)).subscribe(value => {
              this.authService.checkTokenExpiration(error, 1000, true);
            });
          });
      });
    }
  }

  getUserIri(): string {
    return this.userConnected ? this.userConnected.iri : '';
  }

  getAddresses() {
    // appel API pour récupérer les adressses du user
    const idUser = this.apiHttpService.getIdFromIri(this.getUserIri());
    this.apiHttpService.getUserAddresses(idUser)
      .subscribe((arrayAddresses) => {
        // console.log('[DEBUG] AddressComponent, getUserAddresses - 1 ', arrayAddresses);
        this.userAddresses = arrayAddresses;
        if (this.userAddresses.length) {
          if (this.isMerchantSubscriber()) {
            for (const address of this.userAddresses) {
              if (address.shop && address.shopValidated) {
                this.checkForShopMessages(address);
              }
            }
          } else {
            for (const address of this.userAddresses) {
              if (this.isAddressMatchesAssociation(address)) {
                this.checkForShopMessages(address, true);
              }
            }
          }
          this.selectListItem(this.userAddresses[0].id);
          of(keyWaitForDomAvailable).pipe(delay(200)).subscribe(value => {
            this.handleClickAndDoubleClick();
          });
          if (this.isMerchantSubscriber()) {
            for (const userAddress of this.userAddresses) {
              this.retrieveNumberOfUsersAroundAddress(userAddress);
            }
          } else {
            for (const userAddress of this.userAddresses) {
              if (this.isAddressMatchesAssociation(userAddress)) {
                this.retrieveNumberOfUsersAroundAddress(userAddress);
              }
            }
          }
        }
        this.loading = false;
      }, (error) => {
        // console.warn('[DEBUG] AddressComponent, getUserAddresses returns error ', error);
        this.warningMessage = error.errorMessage;
        this.showWarningMessage = true;
        this.loading = false;
        of(keyEnsureErrorDisplay).pipe(delay(2500)).subscribe(value => {
          this.authService.checkTokenExpiration(error, 1000, true);
        });
      });
    //
  }

  checkForShopMessages(address: Address, isPlaceAssociation: boolean = false) {
    this.apiHttpService.getShopNumberMessages(address.id, isPlaceAssociation)
      .subscribe((result) => {
        // console.log('[DEBUG] getShopNumberMessages ', result);
        // number of shop messages => address.msgsCount
        address.msgsCount = result.nbPlaceMessages;
      }, (error) => {
        // console.warn('[DEBUG] AddressComponent, getShopNumberMessages returns error ', error);
        this.warningMessage = error.errorMessage;
        this.showWarningMessage = true;
        this.loading = false;
        of(keyEnsureErrorDisplay).pipe(delay(2500)).subscribe(value => {
          this.authService.checkTokenExpiration(error, 1000, true);
        });
      });
  }

  getTextAddressUnderCountry(address: Address): string {
    const infoCounty = (address.county && address.county !== '') ? address.county + ',' : null;
    const infoAdministrative = (address.administrative && address.administrative !== '') ? address.administrative + ',' : '';
    return infoCounty ? infoCounty : infoAdministrative;
  }

  selectListItem(addressId: number): void {
    this.selectedAddressId = addressId;
    this.authService.userAddressActive = addressId;
  }

  isListItemSelected(address: Address): boolean {
    return (address.id === this.selectedAddressId);
  }

  handleClickAndDoubleClick(targetAddressId: number = 0): void {
    if (this.listItems && this.listItems.toArray() && this.listItems.toArray().length) {
      // console.log('[DEBUG] Mouse Events ', this.listItems.toArray().length);
      for (const listItem of this.listItems.toArray()) {
        const nativeElt = listItem.nativeElement;
        const addressId = nativeElt ? this.getAddressIdFromElement(nativeElt) : 0;
        if (targetAddressId && targetAddressId !== addressId) {
          continue;
        }
        // console.log('[DEBUG] listItem.nativeElement ', addressId, nativeElt);
        if (addressId) {
          // Convert click events into Observable Mouse Events
          const clickEvent = fromEvent<MouseEvent>(nativeElt, 'click');
          const dblClickEvent = fromEvent<MouseEvent>(nativeElt, keyEventDoubleClick);
          /*--*/
          const mergedMouseEvents = merge(clickEvent, dblClickEvent).pipe(debounceTime(150));
          mergedMouseEvents.subscribe(
            (event: MouseEvent) => {
              // toujours sélectionner l'item cliqué (simple-click ET double-click)
              // console.log('[DEBUG] mergedMouseEvents ' + event.type + ' => appeler selectListItem() ', event.detail, addressId);
              this.selectListItem(addressId);
              nativeElt.focus();

              if (event.type === keyEventDoubleClick) {
                // double-click
                of(addressId).pipe(delay(150)).subscribe(value => {
                  // console.log('[DEBUG] mergedMouseEvents ==> gotoVicinity()... ', value);
                  this.gotoVicinity(addressId);
                });
              }
            }
          );
          /*--*/
        }
      }
    }
  }

  getAddressIdFromElement(nativeElt: any): number {
    let addressId = 0;
    const elementId = nativeElt.getAttribute('id');
    // console.log('[DEBUG] getAddressIdFromElement ', elementId);
    if (typeof elementId === 'string' && elementId.startsWith(dataAttrIdPrefix)) {
      const strAddressId = elementId.substring(dataAttrIdPrefix.length);
      addressId = parseInt(strAddressId, 10);
      if (isNaN(addressId)) {
        addressId = 0;
      }
    }
    return addressId;
  }

  gotoVicinity(addressId: number): void {
    // activer l'onglet Vicinity
    this.router.navigate(['/member/vicinity', addressId]);
  }

  addAddressAllowed(): boolean {
    return (!this.apiHttpService.isOffline() && this.userAddresses && !this.loading && this.userAddresses.length < nbMaxAddresses);
  }

  updateAddressAllowed(): boolean {
    return (!this.apiHttpService.isOffline() && this.selectedAddressId !== 0);
  }

  getCurrentAddress(): Address {
    let currentAddress = null;
    const targetAddress = this.userAddresses.filter((item) => {
      return item.id && item.id === this.selectedAddressId;
    });
    // console.log('[DEBUG] AddressComponent - updateAddress() - 0 ', targetAddress, targetAddress.length, typeof targetAddress[0]);
    if (targetAddress.length === 1 && typeof targetAddress[0] === 'object') {
      currentAddress = targetAddress[0];
    }

    return currentAddress;
  }

  addAddress(): void {
    if (!this.apiHttpService.isOffline() && this.addAddressAllowed()) {
      this.addressToForm = new Address(null, this.getUserIri(), '', '', '', '');
      this.switchAddressForm();
    }
  }

  updateAddress(): void {
    const targetAddress = this.getCurrentAddress();
    // console.log('[DEBUG] AddressComponent - updateAddress() - 0 ', targetAddress);
    if (!this.apiHttpService.isOffline() && targetAddress) {
      this.addressToForm = cloneDeep(targetAddress); // object deep copy (with lodash's method)
      this.switchAddressForm();
    }
  }

  addressChanges(address: Address): void {
    // comes from FormAddressComponent after validation
    const targetAddress = this.userAddresses.filter((item) => {
      return item.id && item.id === address.id;
    });
    // console.log('[DEBUG] AddressComponent - addressChanges() - 0 ', targetAddress, targetAddress.length);
    if (targetAddress.length === 1 && typeof targetAddress[0] === 'object') {
      // modification d'une adresse existante
      targetAddress[0] = { ...address }; // recopie l'objet  [ autre technique possible: targetAddress[0] = Object.assign({}, address) ]
      // console.log('[DEBUG] AddressComponent - addressChanges() - 1 ', this.userAddresses);
      this.successMessage = 'Member.address.submit.post.success';
      this.showSuccessMessage = true;
    } else {
      // ajout d'une nouvelle adresse
      this.successMessage = 'Member.address.submit.post.success';
      this.showSuccessMessage = true;
      this.userAddresses.push(address);
    }
    this.switchAddressesList(); // hide form
    of(keyWaitForDomAvailable).pipe(delay(200)).subscribe(value => {
      this.handleClickAndDoubleClick(); // (address.id);
    });
  }

  comeBackToList(isBackAfterRemoval: boolean): void {
    // comes from FormAddressComponent without validation
    this.switchAddressesList(); // hide form
    of(keyWaitForDomAvailable).pipe(delay(200)).subscribe(value => {
      this.handleClickAndDoubleClick();
    });

    if (isBackAfterRemoval) {
      this.successMessage = 'Member.address.action.remove.success';
      this.showSuccessMessage = true;
      // recharger les adresses pour avoir la bonne liste
      this.userAddresses = [];
      this.loading = true;
      this.getAddresses();
    }
  }

  isMerchantSubscriber(): boolean {
    return this.userConnected ? this.userConnected.merchantSubscriber : false;
  }

  isAddressMatchesAssociation(address: Address): boolean {
    return address.shopValidated && address.placeCategories &&
      address.placeCategories.length === 1 && address.placeCategories[0] === assoCategoryCode;
  }

  switchAddressForm(): void {
    this.showMessagesList = false;
    this.showAddressList = false;
    this.showShopForm = false;
    this.showLookingForsList = false;
    this.showAddressForm = true; // switch to address form
  }

  switchMerchantShopForm(addressId): void {
    this.selectListItem(addressId); // select first
    const targetAddress = this.getCurrentAddress();
    if (this.isMerchantSubscriber() && targetAddress) {
      this.addressToShop = targetAddress;
      // console.log('[DEBUG] ctrl addressToForm ', this.addressToForm);
      this.showAddressForm = false;
      this.showMessagesList = false;
      this.showAddressList = false;
      this.showLookingForsList = false;
      this.showShopForm = true; // switch to shop form
    }
  }

  switchMerchantMsgsList(addressId): void {
    this.selectListItem(addressId); // select first
    const targetAddress = this.getCurrentAddress();
    if (this.isMerchantSubscriber() && targetAddress) {
      this.addressToShop = targetAddress;
      this.showAddressForm = false;
      this.showShopForm = false;
      this.showAddressList = false;
      this.showLookingForsList = false;
      this.showMessagesList = true; // switch to messages list
    }
  }

  switchAssoMessages(address: Address): void {
    this.selectListItem(address.id); // select first
    const targetAddress = this.getCurrentAddress();
    if (this.isAddressMatchesAssociation(address) && targetAddress) {
      this.addressToShop = targetAddress;
      this.showAddressForm = false;
      this.showShopForm = false;
      this.showAddressList = false;
      this.showLookingForsList = false;
      this.showMessagesList = true; // switch to messages list
    }
  }

  switchAddressesList(): void {
    this.showAddressForm = false;
    this.showMessagesList = false;
    this.showShopForm = false;
    this.showLookingForsList = false;
    this.showAddressList = true; // switch to addresses list
  }

  switchLookingForsList(address: Address): void {
    this.selectListItem(address.id); // select first
    const targetAddress = this.getCurrentAddress();
    if (targetAddress && !this.isMerchantSubscriber() && !this.isAddressMatchesAssociation(address)) {
      this.addressToShop = targetAddress;
      this.showAddressForm = false;
      this.showShopForm = false;
      this.showAddressList = false;
      this.showMessagesList = false;
      this.showLookingForsList = true; // switch to list of LookingFor items
    }
  }

  retrieveNumberOfUsersAroundAddress(address: Address): void {
    const fromStartingPoint = { latitude: address.latitude, longitude: address.longitude };
    this.apiHttpService.getUsersDataAroundAddress(address.id, true)
    .subscribe((dataUsers) => {
      let nbLocalCustomers = 0;
      const distanceMax = (this.configService.config.heerApiRadius + this.configService.config.toleranceMargin);
      // console.log('[DEBUG] retrieveNumberOfUsersAroundAddress - 0 ', distanceMax);
      for (const localCustomer of dataUsers) {
        if (localCustomer.email !== this.userConnected.email && typeof localCustomer.coords === 'object') {
          // calculer la distance entre fromStartingPoint et ces coords (latitude, longitude)
          const distance = this.mapService.getDistanceBetweenTwoPoints(fromStartingPoint, localCustomer.coords);
          // console.log('[DEBUG] retrieveNumberOfUsersAroundAddress - ' + address.id + ' ', localCustomer, distance);
          if (distance <= distanceMax) {
            nbLocalCustomers++;
          }
        }
      }
      address.nbUsersAround = nbLocalCustomers;
    }, (error) => {
      // console.warn('retrieveNumberOfUsersAroundAddress() error ', error);
      of(keyEnsureErrorDisplay).pipe(delay(2500)).subscribe(value => {
        this.authService.checkTokenExpiration(error, 1000, true);
      });
    });
  }

  shopChanges(objectWrapper: any): void {
    // dans objectWrapper la propriété confirmStatus est optionnellle (fournie seulement en cas de confirmation attendue)
    // comes from FormShopComponent after shop validation or shop removal (address already saved)
    let newMessageInfo = objectWrapper.address.shop 
      ? 'Member.address.merchant.shop.post.success'
      : 'Member.address.merchant.shop.remove.success';
    if (objectWrapper.address.shop && objectWrapper.hasOwnProperty(keyOptionalConfirmStatus)) {
      const confirmStatus = objectWrapper[keyOptionalConfirmStatus];
      if (confirmStatus.hasOwnProperty(keyConfirmStatusValidated) && !confirmStatus[keyConfirmStatusValidated]) {
        newMessageInfo = this.addonTranslator.instantTranslate(confirmStatus[keyConfirmStatusMessage]);
        if (confirmStatus.hasOwnProperty(keyConfirmStatusEmail) && confirmStatus[keyConfirmStatusEmail].trim() !== '') {
          newMessageInfo += ' ' + confirmStatus[keyConfirmStatusEmail];
        } else {
          if (confirmStatus.hasOwnProperty(keyConfirmStatusSentRequests) ) {
            newMessageInfo += ' ' + confirmStatus[keyConfirmStatusSentRequests]
              + ' ' + this.addonTranslator.instantTranslate('Member.address.merchant.shop.ownership.request.recipients');
          }
        }
      }
      if (confirmStatus.hasOwnProperty(keyConfirmStatusValidated) && confirmStatus[keyConfirmStatusValidated]) {
        const targetAddress = this.userAddresses.filter((item) => {
          return item.id && item.id === objectWrapper.address.id;
        });
        if (targetAddress.length === 1 && typeof targetAddress[0] === 'object' && !targetAddress[0].shopValidated) {
          // passer le flag shopValidated à vrai
          targetAddress[0].shopValidated = true;
        }
      }
    }
    this.successMessage = newMessageInfo;
    this.showSuccessMessage = true;
    this.switchAddressesList(); // hide form

    of(keyWaitForDomAvailable).pipe(delay(200)).subscribe(value => {
      this.handleClickAndDoubleClick(); // (address.id);
    });  }
}
