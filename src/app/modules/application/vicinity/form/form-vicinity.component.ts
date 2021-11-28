import { Component, OnInit, AfterViewInit, Input, Output, EventEmitter, ViewChild, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";
import { of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { NgbModal, NgbModalOptions, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import cloneDeep from 'lodash-es/cloneDeep';

import { AppConfigService } from 'src/app/app.config.service';
import { MapComponentService } from 'src/app/modules/general/map/map.component.service';
import { LocationService, keySuggestedAddressProperties } from 'src/app/modules/general/service/location.service';
import { ApiHttpService } from 'src/app/modules/general/service/api.http.service';
import { Place, assoCategoryCode, keyFromSpecificSearch, placeDefaultOrder } from 'src/app/model/place';
import { User } from 'src/app/model/user';
import { Address } from 'src/app/model/address';

const keyCodeProperty = 'code';
const keyLabelProperty = 'label';
const nbMinAssoGuestEmails = 3;
const keyWaitForDomAvailable = 'ensure-dom-availability';

/* ----- Modal ----- >>
@Component({
  selector: 'ngb-modal-content',
  templateUrl: './modal-vicinity.content.html',
})
export class NgbdModalContent {
  @Input() name;

  constructor(public activeModal: NgbActiveModal) {}
}
<< ----------------- */


@Component({
  selector: 'app-form-vicinity',
  templateUrl: './form-vicinity.component.html',
  styleUrls: ['./form-vicinity.component.css']
})
export class FormVicinityComponent implements OnInit, AfterViewInit {

  @Input() user: User;
  @Input() place: Place;
  @Input() startingPoint: Address; // to estimate the distance to another point (choosen by the user)
  @Input() optionCategories: any[];
  @Input() maxOrderInList: number;
  @Input() existingPlaces: Place[];
  @Input() currentLangCode: string;
  @Output() closeWithoutValidation = new EventEmitter<boolean>();
  @Output() placeValidated = new EventEmitter<Place>();
  @ViewChild('modalDecisionForDuplicate') modalDecisionForDuplicate: any;
  @ViewChild('modalShopMessage') modalShopMessage: any;
  @ViewChild('modalAssoExtraForm') modalAssoExtraForm: any;
  @ViewChild('modalInviteMerchant') modalInviteMerchant: any;

  safeHtmlMessage: SafeHtml = null;
  filteredOptionCategories: any[];
  modalOptions: NgbModalOptions;
  sameAddressFoundPlace: Place;
  sameAddressDuplicateRemovalControl: Place;
  doneAddressDuplicateRemovalControl = false;
  unchanged = true;
  requesting = false;
  contactsCopied = false;
  flagsCopied = false;
  assoExtraFormInvalid = true;
  assoGuestContacts: string[];
  warningMessage = '';
  showWarningMessage = false;
  modalAssoWarningMessage = '';
  showModalAssoWarningMessage = false;
  modalAssoRequesting = false;
  assoExtraModalOpenRef: NgbModalRef;
  inviteMerchantModalOpenRef: NgbModalRef;
  invitationProcessing = false;
  successMessage = '';
  showSuccessMessage = false;
  searchLocation: any = {
    type: 'amenity',
    skipIcons: true,
    skipDetails: true,
    biasByCountryCode: null
  };

  constructor(
    private sanitizer: DomSanitizer,
    private translateService: TranslateService,
    private configService: AppConfigService,
    private mapService: MapComponentService,
    private apiHttpService: ApiHttpService,
    private modalService: NgbModal,
    private locationService: LocationService,
    @Inject(PLATFORM_ID) private platformId: object) {

    this.assoGuestContacts = [];
    this.sameAddressFoundPlace = null;
    this.sameAddressDuplicateRemovalControl = null;

    if (isPlatformBrowser(platformId)) {
      this.modalOptions = {
        backdrop: 'static',
        backdropClass: 'customBackdrop'
      };
    }
  }

  ngOnInit(): void {
    // console.log('[DEBUG] ctrl meta tag description ', this.meta.getTag('name=\'description\''));
    // console.log('[DEBUG] ctrl title ', this.title.getTitle());
    if (this.optionCategories) {
      if (this.isNewUserInitiative() || this.isPlaceAssociation()) {
        // autoriser l'utilisation de la catégorie Association
        this.filteredOptionCategories = this.optionCategories;
      } else {
        this.filteredOptionCategories = this.optionCategories.filter((item) => {
          return item.code > assoCategoryCode;
        });
      }
    }
    if (this.place && this.place.popupMessage) {
      this.safeHtmlMessage = this.sanitizer.bypassSecurityTrustHtml(this.place.popupMessage);
    }
    if (this.user) {
      this.searchLocation.biasByCountryCode = [this.user.countryCode];
    }
  }

  ngAfterViewInit() {
    if (this.safeHtmlMessage) {
      of(keyWaitForDomAvailable).pipe(delay(100)).subscribe(value => {
        this.openModalShopMessage();
      });
    }
    // console.log('[DEBUG] place id, isItemUnsaved ?, hasValidEmail ? ', this.place.id, this.isItemUnsaved(), this.place.hasValidEmail);
    if (this.place && this.place.resultType === keyFromSpecificSearch) {
      this.unchanged = false; // pour pouvoir cliquer sur 'Valider' sans avoir fait aucune modif.
    }
  }

  retrieveAddressCoords(selectedAddress: any): void {
    if (selectedAddress.hasOwnProperty(keySuggestedAddressProperties) && selectedAddress[keySuggestedAddressProperties]
      && typeof selectedAddress[keySuggestedAddressProperties] === 'object') {
      let stdAddressLabel = this.locationService.getStandardAddressLabelFromPlaceSelection(selectedAddress[keySuggestedAddressProperties]);
      let stdAddressVariation = this.locationService.getStandardAddressVariationFromPlaceSelection(selectedAddress[keySuggestedAddressProperties]);

      // contrôle doublon d'adresse
      this.sameAddressFoundPlace = this.checkExistingDuplicatePlace(this.place.id, stdAddressLabel, stdAddressVariation);
      // console.log('[DEBUG] sameAddressFoundPlace ? ', this.sameAddressFoundPlace);

      if (this.sameAddressFoundPlace) {
        // console.log('[DEBUG] retrieveAddressCoords ', selectedAddress);
        this.openModalDecisionForDuplicate(stdAddressLabel, selectedAddress[keySuggestedAddressProperties].lat, selectedAddress[keySuggestedAddressProperties].lon);
      } else {
        this.place.positionLat = selectedAddress[keySuggestedAddressProperties].lat;
        this.place.positionLng = selectedAddress[keySuggestedAddressProperties].lon;
        this.place.address = stdAddressLabel;
        this.place.distance = 0; // à calculer (cf. contrôles réalisés dans invalidPlace)
        this.unchanged = false; // pour pouvoir cliquer sur 'Valider'
      }
    }
  }

  checkExistingDuplicatePlace(currentPlaceId: string, addressStandard: string, addressVariation: string): Place {
    // console.log('[DEBUG] checkExistingDuplicatePlace from address... ', addressStandard, addressVariation);

    // contrôler si un des labels (addressDirect, addressStandard) existe déjà dans this.existingPlaces
    let addressAlreadyExists = null;
    let equivAddressplaces = [];
    const variationCheck = (addressStandard !== addressVariation);

    for (const placeEx of this.existingPlaces) {
      if (placeEx.id !== currentPlaceId) {
        // console.log('[DEBUG] checked item ', placeEx.address);
        if (Place.normalizedStringsEquivalence(placeEx.address, addressStandard) ||
          (variationCheck && Place.normalizedStringsEquivalence(placeEx.address, addressVariation))) {
          equivAddressplaces.push(placeEx);
        }
      }
    }

    // vérifier si place trouvée avec exactement la même adresse
    addressAlreadyExists = equivAddressplaces.find((item) => {
      return Place.normalizedStringsEquality(item.address, addressStandard)
        || (variationCheck && Place.normalizedStringsEquality(item.address, addressVariation));
    });
    if (!addressAlreadyExists && equivAddressplaces.length) {
      // à défaut prendre la première place trouvée avec une adresse similaire
      addressAlreadyExists = equivAddressplaces[0];
    }

    return addressAlreadyExists;
  }

  checkExistingDuplicatePlaceDirectAddress(addressDirect: string, currentPlaceId: string): Place {
    // contrôler si addressDirect existe déjà dans this.existingPlaces
    let addressAlreadyExists = null;
    for (const placeEx of this.existingPlaces) {
      if (placeEx.id !== currentPlaceId && !placeEx.logicalRemoval) {
        if (this.isSignificantAddress(placeEx.address) && Place.normalizedStringsEquivalence(placeEx.address, addressDirect)) {
          addressAlreadyExists = placeEx;
          break;
        }
      }
    }
    return addressAlreadyExists;
  }

  checkExistingDuplicateTitle(currentPlaceTitle: string, currentPlaceId: string): Place {
    // contrôler si currentPlaceTitle existe déjà dans this.existingPlaces
    let titleAlreadyExists = null;
    for (const placeEx of this.existingPlaces) {
      if (placeEx.id !== currentPlaceId && !placeEx.logicalRemoval) {
        if (Place.normalizedStringsEquality(placeEx.title, currentPlaceTitle)) {
          titleAlreadyExists = placeEx;
          break;
        }
      }
    }
    return titleAlreadyExists;
  }

  openModalDecisionForDuplicate(addressStandard: string, positionLat: number, positionLng: number) {
    this.modalService.open(this.modalDecisionForDuplicate, this.modalOptions).result.then((result) => {
      // console.log('[MODAL]  then() ', result, this.sameAddressFoundPlace);
      if (result === 'copy-from-existing') {
        let placeCopy = cloneDeep(this.sameAddressFoundPlace); // object deep copy (with lodash's method)

        if (this.sameAddressFoundPlace.userInitiative) {
          // le commerce trouvé avec la même adresse "écrase" celui qui était en édition
          this.place = placeCopy;
        } else {
          // création d'un doublon que le user pourra modifier à sa guise...
          placeCopy.id = this.place.id;
          placeCopy.userInitiative = true;
          placeCopy.address = addressStandard;
          placeCopy.orderInList = this.maxOrderInList;
          this.place = placeCopy;
        }
      } else {
        if (result === 'another-shop') {
          this.place.address = addressStandard;
          this.place.positionLat = positionLat;
          this.place.positionLng = positionLng;
        } else {
          // abandon
          this.place.address = '';
        }
        this.place.distance = 0; // à calculer (cf. contrôles réalisés dans invalidPlace)
      }
      this.sameAddressFoundPlace = null;
    }, (reason) => {
      // abandon
      this.place.address = '';
      this.sameAddressFoundPlace = null;
      this.place.distance = 0; // à calculer (cf. contrôles réalisés dans invalidPlace)
    });
  }

  openModalShopMessage() {
    let specModalOptions = { ...this.modalOptions };
    specModalOptions.size = 'lg';
    specModalOptions.windowClass = 'modal-xxl';

    this.modalService.open(this.modalShopMessage, specModalOptions).result.then((result) => {
      // console.log('[MODAL]  then() ', result);
    }, (reason) => {
      // dismiss
    });
  }

  getTextSearchAddressPlaceholder(): string {
    return this.translateService.instant('Member.vicinity.form.address.placeholder');
  }

  getMessageModalTitle(): string {
    const messageModalTitleCode = 'Member.vicinity.form.message.modal.title.' + (this.isPlaceAssociation() ? 'asso' : 'shop');
    return this.translateService.instant(messageModalTitleCode);
  }

  isSignificantAddress(addressLabel: string): boolean {
    const trimedAdress = addressLabel.trim();
    const startsWithNumber = /^\d/.test(trimedAdress);
    
    return (trimedAdress !== '' && startsWithNumber);
  }

  isOfflineMode(): boolean {
    return this.apiHttpService.isOffline();
  }

  invitationCanBeDone(): boolean {
    return this.place.hasValidEmail && !this.place.merchantRegistered && !this.apiHttpService.isOffline();
  }

  isPushPlaceDisabled(): boolean {
    return (this.apiHttpService.isOffline() || this.unchanged);
  }

  isLogicalRemovalAllowed(): boolean {
    if (this.apiHttpService.isOffline() || this.place.logicalRemoval) {
      // mode déconnecté (pas de réseau), ou déjà marquée comme à supprimer
      return false; // pour désactiver le bouton de suppression
    }

    if (!this.place.userInitiative && !this.doneAddressDuplicateRemovalControl) {
      // contrôle doublon d'adresse (pour rendre possible la suppression si doublon détecté) - à faire une fois seulement
      if (this.place.address && this.isSignificantAddress(this.place.address)) {
        this.sameAddressDuplicateRemovalControl = this.checkExistingDuplicatePlaceDirectAddress(this.place.address, this.place.id);
        // console.log('[DEBUG] sameAddressDuplicateRemovalControl ', this.sameAddressDuplicateRemovalControl);
      }
      if (!this.sameAddressDuplicateRemovalControl) {
        // recherche doublon sur la propriété title
        this.sameAddressDuplicateRemovalControl = this.checkExistingDuplicateTitle(this.place.title, this.place.id);
      }
      this.doneAddressDuplicateRemovalControl = true;
    }

    return (this.isSavedUserInitiative() || this.isDuplicateDetected() || this.isOutOfTheShortlist());
  }

  isItemUnsaved(): boolean {
    return typeof this.place.id === 'string' && 
      (this.place.id.startsWith('user') || this.place.id.startsWith('here'));
  }

  isSavedUserInitiative(): boolean {
    return (this.place.userInitiative && !this.isItemUnsaved());
  }

  isNewUserInitiative(): boolean {
    return (this.place.userInitiative && this.isItemUnsaved());
  }

  isDuplicateDetected(): boolean {
    return (this.sameAddressDuplicateRemovalControl !== null);
  }

  isOutOfTheShortlist(): boolean {
    return (this.place.orderInList === placeDefaultOrder && this.existingPlaces.length > this.configService.config.heerApiLimit);
  }

  isPlaceAssociation(): boolean {
    const categoriesStringsArray = this.arrayDisobjectize(this.place.categories);
    const isAssociation = categoriesStringsArray.length === 1 && categoriesStringsArray[0] === assoCategoryCode;
    // return Place.isAssociation(this.place);
    return isAssociation;
  }

  isUnchangeable(): boolean {
    return !this.place.userInitiative;
  }

  isAddressUnchangeable(): boolean {
    if (this.isUnchangeable()) {
      return true;
    }
    // l'adresse ne doit pas pouvoir être modifiée si la place a été crée comme Association
    return this.isSavedUserInitiative() && this.isPlaceAssociation();
  }

  isCategoryUnchangeable(): boolean {
    if (this.isUnchangeable()) {
      return true;
    }
    // les catégories ne doivent pas pouvoir être modifiées si la place a été crée comme Association
    return this.isSavedUserInitiative() && this.isPlaceAssociation();
  }

  isCategorySelected(a: any, b: any): boolean {
    // The first argument is a value from an option (within this.optionCategories).
    // The second is a value from the selection model (this.place.categories).  -- (this.taggedCategories)
    return (a.code === b);
  }

  getTextCategory(place: Place, ind: number): string {
    let textCategory = '';
    if (place.categories && place.categories.length > ind && typeof place.categories[ind] === 'string') {
      textCategory = place.categories[ind];
    }
    return textCategory;
  }

  getContact(place: Place, ind: number): string {
    let contactInd = '';
    if (place.contacts && place.contacts.length > ind && typeof place.contacts[ind] === 'string') {
      contactInd = place.contacts[ind];
    }
    return contactInd;
  }

  getAddContactItemText(): string {
    const contactAddText = this.translateService.instant('Member.vicinity.form.contacts.addItem.text');
    return contactAddText;
  }

  getAddAssoGuestItemText(): string {
    const guestAddText = this.translateService.instant('Association.form.extra.guests.addItem.text');
    return guestAddText;
  }

  hasContacts(): boolean {
    return (this.place.contacts && this.place.contacts.length > 0);
  }

  hasContactsToCopy(): boolean {
    return this.hasContacts() && !this.contactsCopied;
  }

  infoContactsToCopy(): any {
    return this.place.contacts;
  }

  markContactsAsCopied(): void {
    this.contactsCopied = true;
  }

  getAddFlagItemText(): string {
    const flagAddText = this.translateService.instant('Member.vicinity.form.flags.addItem.text');
    return flagAddText;
  }

  hasFlags(): boolean {
    return (this.place.flags && this.place.flags.length > 0);
  }

  hasFlagsToCopy(): boolean {
    return this.hasFlags() && !this.flagsCopied;
  }

  infoFlagsToCopy(): any {
    return this.place.flags;
  }

  markFlagsAsCopied(): void {
    this.flagsCopied = true;
  }

  decrementOrderInList() {
    if (this.place.orderInList > 1) {
      if (this.place.orderInList === placeDefaultOrder) {
        this.place.orderInList = this.maxOrderInList;
      } else {
        this.place.orderInList--;
      }
    }
  }

  incrementOrderInList() {
    if (this.place.orderInList < placeDefaultOrder) {
      this.place.orderInList++;
    }
  }

  backToParent(): void {
    this.closeWithoutValidation.emit(true);
  }

  invalidPlace(): boolean {
    // title obligatoire
    if (this.place.title.trim() === '') {
      this.warningMessage = 'Member.vicinity.form.invalid.title.required';
      return true;
    }
    // address obligatoire
    if (this.place.address.trim() === '') {
      this.warningMessage = 'Member.vicinity.form.invalid.address.required';
      return true;
    }

    if (this.place.userInitiative) {
      if (!this.place.positionLat || !this.place.positionLng) {
        this.warningMessage = 'Member.vicinity.form.invalid.address.not.geolocated';
        return true;
      }
      // au moins une catégorie doit être sélectionnée
      if (!this.place.categories || !this.place.categories.length) {
        this.warningMessage = 'Member.vicinity.form.invalid.categories.required';
        return true;
      }
      // au moins un contact doit être renseigné
      if (!this.place.contacts || !this.place.contacts.length) {
        this.warningMessage = 'Member.vicinity.form.invalid.contacts.required';
        return true;
      }

      if (!this.place.distance) {
        const placeCoords = { latitude: this.place.positionLat, longitude: this.place.positionLng };
        // calculer la distance entre this.startingPoint et placeCoords (place.positionLat, place.positionLng)
        this.place.distance = this.mapService.getDistanceBetweenTwoPoints(this.startingPoint, placeCoords);
        // console.log('[DEBUG] distance estimée ', this.place.distance);
        if (this.place.distance > (this.configService.config.heerApiRadius + this.configService.config.toleranceMargin)) {
          const kmDist = this.place.distance / 1000;
          this.warningMessage = this.translateService.instant(
            'Member.vicinity.form.invalid.distance.too.great', { distance: kmDist.toFixed(3) }
          );
          this.place.distance = 0;
          return true;
        }
      }
    }

    if (!this.place.orderInList) {
      this.warningMessage = 'Member.vicinity.form.invalid.order.required';
      return true;
    }
    if (this.place.orderInList !== placeDefaultOrder && (this.place.orderInList < 1 || this.place.orderInList > this.maxOrderInList)) {
      this.warningMessage = this.translateService.instant(
        'Member.vicinity.form.invalid.order.bounds', { max: this.maxOrderInList }
      );
      return true;
    }

    return false;
  }

  pushPlace(): void {
    if (this.invalidPlace()) {
      this.showWarningMessage = true;
      return;
    }

    // mise en forme standard des contacts
    // this.place.contacts.map(contactItem => {
    //   // on veut un array de strings (pas un array d'objets)
    //   return contactItem.hasOwnProperty(keyLabelProperty) ? contactItem[keyLabelProperty] : contactItem;
    // });
    let isObject = null;
    let itemObjectFound = false;
    // ajout de controles spécifiques si catégorie === assoCategoryCode (cf. const définie dans model/place.ts)
    let contactValue = '';
    let userEmailAsContact = false;
    let newPlaceContacts = [];
    for (let contactItem of this.place.contacts) {
      isObject = contactItem.hasOwnProperty(keyLabelProperty);
      // chaque item doit être une string (pas un objet)
      contactValue = isObject ? contactItem[keyLabelProperty] : contactItem;
      newPlaceContacts.push(contactValue);
      if (isObject) {
        itemObjectFound = true;
      }
      if (!userEmailAsContact && (contactValue === this.user.email)) {
        userEmailAsContact = true;
      }
    }
    if (itemObjectFound) {
      this.place.contacts = newPlaceContacts;
      // console.log('[DEBUG] check contacts at the end of the FormVicinityComponent ', this.place.contacts);
    }

    // mise en forme standard des catégories
    itemObjectFound = false;
    let categoryCode = '';
    let isAssociation = false;
    let newPlaceCategories = [];
    for (let categItem of this.place.categories) {
      isObject = categItem.hasOwnProperty(keyCodeProperty);
      // chaque item doit être une string (pas un objet)
      categoryCode = isObject ? categItem[keyCodeProperty] : categItem;
      if (!isAssociation && (categoryCode === assoCategoryCode)) {
        isAssociation = true;
      }
      newPlaceCategories.push(categoryCode);
      if (isObject) {
        itemObjectFound = true;
      }
    }
    if (itemObjectFound) {
      this.place.categories = newPlaceCategories;
      // console.log('[DEBUG] check categories at the end of the FormVicinityComponent ', this.place.categories);
    }

    if (isAssociation && this.isNewUserInitiative()) {
      // si newPlaceCategories contient le code réservé aux Associations, il ne faut garder que ce dernier
      if (!userEmailAsContact) {
        // stopper la validation si l'email du user ne fait pas partie des contacts de l'asso
        this.warningMessage = 'Association.form.invalid.your.email.not.in.contacts';
        this.showWarningMessage = true;
        return;
      }
      const userStandardAddress = Address.getStandardizedAddressString(this.startingPoint);
      const userAddressSameness = Place.normalizedStringsEquality(this.place.address, userStandardAddress);
      // = Place.normalizedStringsEquivalence(this.place.address, userStandardAddress)
      if (!userAddressSameness) {
        // stopper la validation si l'adresse de l'asso n'est pas identique à celle du user
        this.warningMessage = 'Association.form.invalid.your.address.not.the.same';
        this.showWarningMessage = true;
        return;
      }
      this.place.categories = [assoCategoryCode];
    }

    // mise en forme standard des flags
    itemObjectFound = false;
    let newPlaceFlags = [];
    for (let flagItem of this.place.flags) {
      isObject = flagItem.hasOwnProperty(keyLabelProperty);
      // chaque item doit être une string (pas un objet)
      newPlaceFlags.push(isObject ? flagItem[keyLabelProperty] : flagItem);
      if (isObject) {
        itemObjectFound = true;
      }
    }
    if (itemObjectFound) {
      this.place.flags = newPlaceFlags;
      // console.log('[DEBUG] ctrl flags at the end of the FormVicinityComponent ', this.place.flags);
    }

    if (this.place.logicalRemoval) {
      // si la place avait préalablement été marquée logicalRemoval, on la "remet dans le jeu"
      this.place.logicalRemoval = false;
      this.place.removalReason = 0;
    }

    if (isAssociation && this.isNewUserInitiative()) {
      // => ouvrir modale de confirmation (cf. #modalAssoExtraForm) avec saisie obligatoire de 3 adresses mail de membres bénévoles
      this.openModalAssoExtraForm();
    } else {
      this.placeValidated.emit(this.place);
    }
  }

  removePlace(): void {
    if (this.isLogicalRemovalAllowed()) {
      if (this.isSavedUserInitiative()) {
        this.place.logicalRemoval = true;
        this.place.removalReason = 1;
      } else {
        if (this.isDuplicateDetected()) {
          this.place.logicalRemoval = true;
          this.place.removalReason = 2; // duplicate
        } else {
          // isOutOfTheShortlist()
          this.place.logicalRemoval = true;
          this.place.removalReason = 3;
        }
      }

      this.placeValidated.emit(this.place);
    }
  }

  checkContactRemoval(itemEvent) {
    const contactValue = itemEvent.hasOwnProperty(keyLabelProperty) ? itemEvent[keyLabelProperty] : itemEvent['value'];

    if (contactValue === this.user.email) {
      // si la place a été crée comme Association, l'email de l'initiateur doit rester dans ses contacts
      const categoriesStringsArray = this.arrayDisobjectize(this.place.categories);
      const isAssociation = categoriesStringsArray.length === 1 && categoriesStringsArray[0] === assoCategoryCode;
      if (isAssociation) {
        //of(keyWaitForDomAvailable).pipe(delay(100)).subscribe(value => {
          //this.place.contacts.push(contactValue);
          this.place.contacts = [...this.place.contacts, contactValue];
          this.warningMessage = 'Association.form.asso.your.email.required.in.contacts';
          this.showWarningMessage = true;
        //});
      }
    }
  }

  arrayDisobjectize(objectsArray: any[]): string[] {
    let stringsArray = [];

    for (let item of objectsArray) {
      // chaque item doit être une string (pas un objet)
      stringsArray.push(item.hasOwnProperty(keyLabelProperty) ? item[keyLabelProperty] : item);
    }

    return stringsArray;
  }

  openModalAssoExtraForm() {
    let specModalOptions = { ...this.modalOptions };
    specModalOptions.size = 'lg';
    specModalOptions.windowClass = 'modal-xxl';

    this.assoExtraModalOpenRef = this.modalService.open(this.modalAssoExtraForm, specModalOptions);
    this.assoExtraModalOpenRef.result.then((result) => {
      // console.log('[MODAL] AssoExtraForm, then() ', result);
      if (result === 'confirm') {} // désormais tout est fait dans submitAssoGuestContacts()
      // car la modale doit rester ouverte si les "invités" ne sont pas validés par l'API 
    }, (reason) => {
      // dismiss
      this.assoExtraModalOpenRef = null;
    });
  }

  submitAssoGuestContacts() {
    // vérifier côté serveur les adresses mail adhérents "invités"
    const guestAssoMembers = this.arrayDisobjectize(this.assoGuestContacts);
    if (this.showModalAssoWarningMessage) {
      this.modalAssoWarningMessage = '';
      this.showModalAssoWarningMessage = false;
    }
    this.modalAssoRequesting = true;
    this.apiHttpService.postSuggestedGuests(this.startingPoint.id, this.place, guestAssoMembers)
      .subscribe((result) => {
        this.modalAssoRequesting = false;
        // console.log('[DEBUG] result of postSuggestedGuests ', result);
        if (result.validated) {
          this.place.asso = { spec: true }; // requis pour marquage "shopValidated" côté API
          // fermer la modale
          if (this.assoExtraModalOpenRef) {
            this.assoExtraModalOpenRef.close('confirm');
          }
          // retour au composant parent
          this.placeValidated.emit(this.place);
        } else {
          this.modalAssoWarningMessage = this.translateService.instant('Association.form.extra.guests.submit.error')
            + ' ' + result.rejectedEmails;
          this.showModalAssoWarningMessage = true;
        }
      }, (error) => {
        this.modalAssoWarningMessage = error.errorMessage;
        this.showModalAssoWarningMessage = true;
        this.modalAssoRequesting = false;
      });
  }

  controlGuestEmailValidity(): void {
    // controler this.assoGuestContacts
    const listOfGuests = this.arrayDisobjectize(this.assoGuestContacts);
    let nbValidItems = 0;
    let nbInvalidItems = 0;
    let isEmailValid = false;
    // console.log('[DEBUG] controlGuestEmailValidity - listOfGuests ', listOfGuests);
    for (let item of listOfGuests) {
      isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item);
      if (isEmailValid) {
        nbValidItems++;
      } else {
        nbInvalidItems++;
      }
    }
    // console.log('[DEBUG] controlGuestEmailValidity - nb valids / invalids ', nbValidItems, nbInvalidItems);
    // asso extra form valide si les items saisis sont tous des emails valides et au nombre minimal requis
    this.assoExtraFormInvalid = (nbInvalidItems > 0 || nbValidItems < nbMinAssoGuestEmails);
  }

  invitationToConfirm(): void {
    if (this.apiHttpService.isOffline()) {
      return ;
    }
    let specModalOptions = { ...this.modalOptions };
    specModalOptions.size = 'lg';
    specModalOptions.windowClass = 'modal-xxl';

    this.inviteMerchantModalOpenRef = this.modalService.open(this.modalInviteMerchant, specModalOptions);
    this.inviteMerchantModalOpenRef.result.then((result) => {
      if (result === 'confirm') {} // le reste est fait dans inviteToRegister()
    }, (reason) => {
      // dismiss
      this.inviteMerchantModalOpenRef = null;
    });
  }

  inviteToRegister(): void {
    this.invitationProcessing = true;
    this.apiHttpService.postMerchantInvitation(this.place.id, this.startingPoint)
      .subscribe((result) => {
        this.invitationProcessing = false;
        // console.log('[DEBUG] result of postMerchantInvitation ', result);
        if (result.validated) {
          this.successMessage = this.translateService.instant('Invitation.merchant.sending.submit.success');
          this.showSuccessMessage = true;
        } else {
          this.warningMessage = this.translateService.instant('Invitation.merchant.sending.submit.error')
            + ' ' + result.rejectedEmails;
          this.showWarningMessage = true;
        }
        // fermer la modale
        if (this.inviteMerchantModalOpenRef) {
          this.inviteMerchantModalOpenRef.close('confirm');
        }
      }, (error) => {
        this.warningMessage = error.errorMessage;
        this.showWarningMessage = true;
        this.invitationProcessing = false;
        // fermer la modale
        if (this.inviteMerchantModalOpenRef) {
          this.inviteMerchantModalOpenRef.close('cancel');
        }
      });
  }

}
