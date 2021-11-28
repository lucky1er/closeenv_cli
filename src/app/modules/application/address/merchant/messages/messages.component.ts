import { Component, OnInit, Input, Output, EventEmitter, ViewChildren, QueryList, ElementRef, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, DOCUMENT } from '@angular/common';
import { of, Subject } from 'rxjs';
import { delay, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import cloneDeep from 'lodash-es/cloneDeep';

import { AppConfigService } from 'src/app/app.config.service';
import { AuthService } from 'src/app/modules/general/service/auth.service';
import { ApiHttpService } from 'src/app/modules/general/service/api.http.service';
import { BrowserService } from 'src/app/modules/general/service/browser.service';
import { AddOnTranslationService } from 'src/app/modules/general/service/addOn.translation.service';
import { User } from 'src/app/model/user';
import { Place } from 'src/app/model/place';
import { Address } from 'src/app/model/address';
import { ShopMessage } from 'src/app/model/shopMessage';
//import { registerLocaleData } from '@angular/common';
//import localeFr from '@angular/common/locales/fr';

const defaultItemsPerPage = 10;
const dataAttrIdMessage = 'id';
const dataAttrIdPrefix = 'i-';
const lengthDateIsoFormat = 10; // 'AAAA-MM-JJ'
const keyEnsureErrorDisplay = 'ensure-error-display';
const keyWaitForDomAvailable = 'ensure-dom-availability';

@Component({
  selector: 'app-messages',
  templateUrl: './messages.component.html',
  styleUrls: ['./messages.component.css']
})
export class MessagesComponent implements OnInit {

  // Accessing multiple native DOM elements using QueryList
  @ViewChildren('itemMessage') listItems: QueryList<ElementRef>;

  @Input() address: Address;
  @Output() closeChildComponent = new EventEmitter<boolean>();

  locale: string;
  userConnected: User = null;
  myShop: Place = null;
  pageActive: number; // pagination
  filter: any;
  unfilteredMessages: ShopMessage[]; // before applying the filter
  shopMessages: ShopMessage[]; // after applying the filter
  messageToForm: ShopMessage;
  selectedMessageId = '';
  dataLoading = true;
  showList = true;
  showForm = false;
  warningMessage = '';
  showWarningMessage = false;
  successMessage = '';
  showSuccessMessage = false;
  nbItemsPerPage = defaultItemsPerPage;
  nbIPPChanged: Subject<number> = new Subject<number>();
  filterChanged: Subject<any> = new Subject<any>();

  constructor(
    @Inject(DOCUMENT) private document: Document,
    @Inject(PLATFORM_ID) private platformId: object,
    private translateService: TranslateService,
    private addonTranslator: AddOnTranslationService,
    private authService: AuthService,
    private apiHttpService: ApiHttpService,
    private browserService: BrowserService,
    private configService: AppConfigService) {

    //registerLocaleData(localeFr, 'fr');

    // gestion des changements de valeur pour this.nbItemsPerPage
    this.nbIPPChanged.pipe(
      debounceTime(400), // wait 400ms after the last change event before emitting last event
      distinctUntilChanged() // only emit if value is different from previous value
    ).subscribe(ippValue => {
      // console.log('[DEBUG] IPP last changed ', ippValue, typeof ippValue);
      this.nbItemsPerPage = ippValue;
      this.browserService.setLocalStorageItem(this.getKeyIPP(), this.nbItemsPerPage);
    });
    // changements de valeur pour une des checkboxes constituant le filtre
    this.filterChanged.pipe(
      debounceTime(400),
      distinctUntilChanged()
    ).subscribe(wrapCriteria => {
      // console.log('[DEBUG] Filter bool criteria last changed', wrapCriteria);
      switch (wrapCriteria.filterIndex) {
        case 1:
          this.filter.onlyPendingDate = wrapCriteria.filterValue;
          this.applyFilter();
          break;
        case 2:
          this.filter.onlyNotYetSent = wrapCriteria.filterValue;
          this.applyFilter();
          break;
        default:
          console.warn(`Filter changed index not expected: ${wrapCriteria.filterIndex}. `, wrapCriteria);
      }
    });
  }

  ngOnInit(): void {
    this.pageActive = 0;
    this.userConnected = this.authService.userConnected;
    this.locale = this.addonTranslator.getDeterminedLocale();
    if (this.address) {
      this.getDatasFromApi();
    }

    const storedFilter = this.address ? this.browserService.getLocalStorageSerializable(this.getKeyFilter()) : null;
    if (storedFilter) {
      this.filter = storedFilter;
    } else {
      this.filter = {
        onlyPendingDate: true,
        onlyNotYetSent: false
      };
    }
    // console.log('[DEBUG] storedFilter ', storedFilter);
    const lastoredIPP = this.browserService.getLocalStorageItem(this.getKeyIPP());
    if (lastoredIPP) {
      const numberIPP = parseInt(lastoredIPP, 10);
      if (!isNaN(numberIPP)) {
        this.nbItemsPerPage = numberIPP;
      }
    }
  }

  getKeyFilter(): string {
    const keyPrefix = 'filter_sm_';
    return keyPrefix + this.address.id;
  }

  getKeyIPP(): string {
    return 'nb_ipp_sm';
  }

  getDatasFromApi() {
    this.dataLoading = true;
    // appel API pour récupérer le shop
    this.apiHttpService.getShopPlace(this.address.id)
      .subscribe((place) => {
        this.myShop = place;
        this.getMessagesFromPlace();
      }, (error) => {
        this.dataLoading = false;
        // console.warn('[API] MessagesComponent OnInit - 9 ', error);
        this.warningMessage = error.errorMessage;
        this.showWarningMessage = true;
        of(keyEnsureErrorDisplay).pipe(delay(2500)).subscribe(value => {
          this.authService.checkTokenExpiration(error, 1000, true);
        });
      });
  }

  getMessagesFromPlace(): void {
    // récupérer les messages enregistrés pour le commerce (ou l'asso.)
    this.apiHttpService.getPlaceMessages(this.myShop)
      .subscribe((placeMessages: ShopMessage[]) => {
        this.unfilteredMessages = placeMessages;
        if (this.unfilteredMessages.length) {
          // this.unfilteredMessages.sort(ShopMessage.sortByDate);
          this.applyFilter();
        }
        this.dataLoading = false;
        // console.log('[DEBUG] MessagesComponent, getPlaceMessages - 1 ', shopMessages.length);
      }, (error) => {
        // console.warn('[DEBUG] MessagesComponent, getPlaceMessages - 9 ', error);
        this.warningMessage = error.errorMessage;
        this.showWarningMessage = true;
        this.dataLoading = false;
        of(keyEnsureErrorDisplay).pipe(delay(2500)).subscribe(value => {
          this.authService.checkTokenExpiration(error, 1000, true);
        });
      });
  }

  getTextForListTitle(): string {
    let listTitleCode = 'Merchant.shop.messages.list.title';
    if (this.myShop) {
      listTitleCode += Place.isAssociation(this.myShop) ? '.asso' : '.shop';
    }
    return this.translateService.instant(listTitleCode);
  }

  getTextForShopLabel(): string {
    let shopLabel = '...';
    if (this.myShop && typeof this.myShop === 'object' && this.myShop.hasOwnProperty('title')) {
      shopLabel = this.myShop.title;
    }
    return shopLabel;
  }

  filterNotAllSelected(): boolean {
    return (this.unfilteredMessages && this.shopMessages && this.unfilteredMessages.length !== this.shopMessages.length);
  }

  applyFilter(): void {
    // build this.shopMessages from this.unfilteredMessages, applying current filter (this.filter)
    let filteredMessages = [];
    const dateNow = new Date().toISOString().substring(0, lengthDateIsoFormat);
    // console.log('[DEBUG] applyFilter(), avant filtrage ', dateNow, this.unfilteredMessages.length);

    if (this.filter.onlyPendingDate || this.filter.onlyNotYetSent) {
      // console.log('[DEBUG] Application Filtre ', this.filterCategories);
      filteredMessages = this.unfilteredMessages.filter((message: ShopMessage) => {
        let selected = true;
        if (this.filter.onlyNotYetSent && message.numberOfRecipients) {
          selected = false;
        } else {
          if (this.filter.onlyPendingDate) {
            /* console.log('[DEBUG] ctrl-dates-filter  1 ',
              (dateNow < message.validFrom.substring(0, lengthDateIsoFormat)),
              (dateNow > message.validTo.substring(0, lengthDateIsoFormat))
            ); */
            if (dateNow < message.validFrom.substring(0, lengthDateIsoFormat) 
              || dateNow > message.validTo.substring(0, lengthDateIsoFormat)) {
              // console.log('[DEBUG] ctrl-dates-filter  2 ', dateNow, message.validFrom.substring(0, lengthDateIsoFormat));
              selected = false;
            }
          }
        }
        return selected;
      });
    } else {
      // all items are selected
      filteredMessages = this.unfilteredMessages;
    }

    this.shopMessages = filteredMessages;
    if (this.shopMessages.length) {
      this.selectListItem(this.shopMessages[0]);
      of(keyWaitForDomAvailable).pipe(delay(200)).subscribe(value => {
        this.isListItemSelected(this.shopMessages[0], 0); // juste pour targetNativeElement.focus()
      });
      this.pageActive = 1;
    } else {
      this.selectedMessageId = '';
      this.pageActive = 0;
    }

    this.browserService.setLocalStorageSerializable(this.getKeyFilter(), this.filter);
  }

  queueChangeFilter(checkBoxEvent: any, index: number) {
    this.filterChanged.next({filterIndex: index, filterValue: checkBoxEvent.target.checked});
  }

  queueChangeIPP(newValueIPP: number) {
    this.nbIPPChanged.next(newValueIPP);
  }

  totalPagesNumber(numberItemsToDisplay: number = null): number {
    if (numberItemsToDisplay === null) {
      numberItemsToDisplay = this.shopMessages ? this.shopMessages.length : 0;
    }
    const nbLast = numberItemsToDisplay % this.nbItemsPerPage; // reste de la division entière
    let nbPages = parseInt((numberItemsToDisplay / this.nbItemsPerPage).toPrecision(), 10); // nombre de pages "complètes"
    if (nbLast) {
      nbPages++; // la dernière page est "incomplète"
    }
    return nbPages;
  }

  getPages(): number[] {
    const pages = [];
    const nbPages = this.totalPagesNumber();
    for (let i = 1; i <= nbPages; i++) {
      pages.push(i);
    }
    return pages;
  }

  getPageMessages(): ShopMessage[] {
    if (!this.shopMessages || !this.shopMessages.length) {
      return [];
    }

    // gestion de la pagination dans liste des messages
    const pageMessages = [];
    const nbItems = this.shopMessages.length;
    const nbLast = nbItems % this.nbItemsPerPage; // reste de la division entière
    const nbPages = this.totalPagesNumber(nbItems);
    if (!this.pageActive || this.pageActive > nbPages) {
      this.pageActive = 1;
    }
    // constituer pageMessages avec les éléments de this.shopMessages correspondant à this.pageActive
    const activeStartingFrom0 = this.pageActive - 1;
    const firstIndex = activeStartingFrom0 * this.nbItemsPerPage;
    let lastIndex = firstIndex + this.nbItemsPerPage - 1;
    if (this.pageActive === nbPages && nbLast) {
      lastIndex = firstIndex + nbLast - 1;
      if (lastIndex > (nbItems - 1)) {
        // ne devrait jamais arriver
        lastIndex = nbItems - 1;
      }
    }
    let foundCurrentSelected = false;
    for (let i = firstIndex; i <= lastIndex; i++) {
      if (this.shopMessages[i].id === this.selectedMessageId) {
        foundCurrentSelected = true;
      }
      pageMessages.push(this.shopMessages[i]);
    }
    if (!foundCurrentSelected) {
      this.selectedMessageId = this.shopMessages[firstIndex] ? this.shopMessages[firstIndex].id : '';
    }
    return pageMessages;
  }

  decrementPageActive(): void {
    if (this.pageActive > 1) {
      this.pageActive--;
      this.changeSelectedItemNewPageActive();
    }
  }

  incrementPageActive(): void {
    if (this.pageActive < this.totalPagesNumber()) {
      this.pageActive++;
      this.changeSelectedItemNewPageActive();
    }
  }

  gotoPageActive(pageNum: number): void {
    if (pageNum > 0 && pageNum <= this.totalPagesNumber()) {
      this.pageActive = pageNum;
      this.changeSelectedItemNewPageActive();
    }
  }

  changeSelectedItemNewPageActive(): void {
    const activeStartingFrom0 = this.pageActive - 1;
    const firstIndex = activeStartingFrom0 * this.nbItemsPerPage;
    if (this.shopMessages[firstIndex] && this.shopMessages[firstIndex].hasOwnProperty('id')) {
      // sélectionner par défaut le premier item visible
      this.selectListItem(this.shopMessages[firstIndex]);
      of(keyWaitForDomAvailable).pipe(delay(200)).subscribe(value => {
        this.isListItemSelected(this.shopMessages[firstIndex], 0); // juste pour targetNativeElement.focus()
      });
    } else {
      // aucun item sélectionné par défaut
      this.selectedMessageId = '';
    }
  }

  selectListItem(message: ShopMessage): void {
    this.selectedMessageId = message.id;
  }

  findListItemIndex(arrayItems: ElementRef[], wantedId: string): number {
    for (let ind = 0, len = arrayItems.length; ind < len; ind++) {
      // console.log('[DEBUG]  findListItemIndex ', ind, arrayItems[ind].nativeElement.getAttribute(dataAttrIdMessage));
      if (arrayItems[ind].nativeElement.getAttribute(dataAttrIdMessage) === dataAttrIdPrefix + wantedId) {
        return ind;
      }
    }
    return -1;
  }

  getMessageIdFromListItem(arrayItems: ElementRef[], index: number): any {
    if (arrayItems[index]) {
      let strMessageId = arrayItems[index].nativeElement.getAttribute(dataAttrIdMessage);
      let intMessageId = 0;
      let idNumeric = true;
      if (typeof strMessageId === 'string') {
        strMessageId = strMessageId.substring(dataAttrIdPrefix.length);
        intMessageId = parseInt(strMessageId, 10);
        if (isNaN(intMessageId)) {
          idNumeric = false;
        }
      }
      return idNumeric ? intMessageId : strMessageId;
    }

    return null;
  }

  listSelectArrowUp(): void {
    // const currentFocus = this.document.activeElement.getAttribute(dataAttrIdMessage);
    if (this.listItems && this.listItems.toArray() && this.listItems.toArray().length) {
      // const idElement = this.listItems.filter((elt, ind) => elt.nativeElement.getAttribute(dataAttrIdMessage) === currentSelectId);
      const arrayItems = this.listItems.toArray();
      const currentIndex = this.findListItemIndex(arrayItems, this.selectedMessageId);
      // console.log('[DEBUG]  currentIndex ', currentIndex);
      if (currentIndex > 0) {
        const nextSelectedMessageId = this.getMessageIdFromListItem(arrayItems, currentIndex - 1);
        if (nextSelectedMessageId) {
          this.selectedMessageId = nextSelectedMessageId;
        }
      }
    }
  }

  listSelectArrowDown(): void {
    if (this.listItems && this.listItems.toArray() && this.listItems.toArray().length) {
      const arrayItems = this.listItems.toArray();
      const currentIndex = this.findListItemIndex(arrayItems, this.selectedMessageId);
      if (currentIndex < arrayItems.length) {
        const nextSelectedMessageId = this.getMessageIdFromListItem(arrayItems, currentIndex + 1);
        if (nextSelectedMessageId) {
          this.selectedMessageId = nextSelectedMessageId;
        }
      }
    }
  }

  isListItemSelected(message: ShopMessage, index: number): boolean {
    const itemMessageSelected = (message.id === this.selectedMessageId);

    if (itemMessageSelected && isPlatformBrowser(this.platformId)) {
      const targetFocus = dataAttrIdPrefix + message.id;
      const currentFocus = this.document.activeElement.getAttribute(dataAttrIdMessage);
      if (currentFocus !== targetFocus && this.document.getElementById(targetFocus)) {
        if (this.listItems && this.listItems.toArray() && this.listItems.toArray().length > index) {
          const targetNativeElement = this.listItems.toArray()[index].nativeElement;
          if (targetNativeElement) {
            targetNativeElement.focus();
          }
        }
      }
    }

    return itemMessageSelected;
  }

  backToParent(): void {
    this.closeChildComponent.emit(true);
  }

  doShowList(): void {
    this.showForm = false;
    this.showList = true; // switch to list
  }

  doShowForm(): void {
    this.showList = false;
    this.showForm = true; // switch to form
  }

  updateMessage(): void {
    const targetMessage = this.shopMessages.filter((item) => {
      return item.id && item.id === this.selectedMessageId;
    });
    // console.log('[DEBUG] MessagesComponent - updateMessage() - 0 ', targetMessage, targetMessage.length, typeof targetMessage[0]);
    if (targetMessage.length === 1 && typeof targetMessage[0] === 'object') {
      this.messageToForm = cloneDeep(targetMessage[0]); // object deep copy (with lodash's method)
      this.doShowForm();
    }
  }

  addMessageAllowed(): boolean {
    return !this.apiHttpService.isOffline();
  }

  addMessage(): void {
    if (this.addMessageAllowed()) {
      // ajout d'un ShopMessage
      const tempId = 'user' + this.unfilteredMessages.length;
      const todayIso = new Date().toISOString().substring(0, lengthDateIsoFormat);
      const isPlaceAsso = Place.isAssociation(this.myShop);
      const shopIdent = isPlaceAsso ? null : this.address.shop;
      const assoIdent = isPlaceAsso ? this.address.shop : null;
      // initialiser le message avec un id temporaire
      this.messageToForm = new ShopMessage('', shopIdent, assoIdent, this.translateService.getDefaultLang(), '', '', todayIso);
      this.doShowForm();
    }
  }

  messageChanges(message: ShopMessage): void {
    // comes from FormMessageComponent after validation
    const messageIndex = this.unfilteredMessages.findIndex((item) => {
      return item.id && item.id === message.id;
    });

    if (messageIndex !== -1) {
      // modification d'un message existant
      this.unfilteredMessages[messageIndex] = cloneDeep(message); // object deep copy (with lodash's method)
    } else {
      // ajout d'un nouveau message
      this.unfilteredMessages.push(message);
    }
    this.successMessage = 'Merchant.shop.message.form.btn.submit.post.success';
    this.showSuccessMessage = true;
    this.applyFilter();

    this.doShowList();
  }

  comeBackToList(isBackAfterRemoval: boolean): void {
    // comes from FormMessageComponent
    this.doShowList(); // hide form

    if (isBackAfterRemoval) {
      this.successMessage = 'Merchant.shop.message.action.remove.success';
      this.showSuccessMessage = true;
      // recharger les messages pour avoir la bonne liste
      this.unfilteredMessages = [];
      this.shopMessages = [];
      this.dataLoading = true;
      this.getMessagesFromPlace();
    }
  }

}
