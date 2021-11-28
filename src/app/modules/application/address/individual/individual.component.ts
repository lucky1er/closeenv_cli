import { Component, OnInit, Input, Output, EventEmitter, QueryList, ViewChildren } from '@angular/core';
import { of, Subject } from 'rxjs';
import { delay, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { FocusKeyManager } from '@angular/cdk/a11y';
import { ENTER, UP_ARROW, DOWN_ARROW } from '@angular/cdk/keycodes';
import cloneDeep from 'lodash-es/cloneDeep';

import { AuthService } from 'src/app/modules/general/service/auth.service';
import { ApiHttpService } from 'src/app/modules/general/service/api.http.service';
import { BrowserService } from 'src/app/modules/general/service/browser.service';
import { AddOnTranslationService } from 'src/app/modules/general/service/addOn.translation.service';
import { Address } from 'src/app/model/address';
import { LookingFor } from 'src/app/model/lookingFor';
import { LookingForListItemComponent } from './lookingFor-listItem.component';

const defaultItemsPerPage = 10;
const keyEnsureErrorDisplay = 'ensure-error-display';
const keyWaitForDomAvailable = 'ensure-dom-availability';
const addressApiGen = '/api/addresses/';

@Component({
  selector: 'app-individual',
  templateUrl: './individual.component.html',
  styleUrls: ['./individual.component.css']
})
export class IndividualComponent implements OnInit {

  // Accessing multiple native DOM elements using QueryList
  @ViewChildren('itemLookingFor') listItems: QueryList<LookingForListItemComponent>;

  @Input() address: Address;
  @Output() closeChildComponent = new EventEmitter<boolean>();

  pageActive: number; // pagination
  filter: any;
  unfilteredLookingFors: LookingFor[]; // before applying the filter
  addressLookingFors: LookingFor[]; // after applying the filter
  activePageLookingFors: LookingFor[]; // items list into the current page view
  lookingForToForm: LookingFor;
  selectedLookingForId = '';
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
  keyManager: FocusKeyManager<LookingForListItemComponent>;
  activePlaceItemIndex: number;
  pageActiveSwitch: number;
  iriRoot: string;
  locale: string;

  constructor(
    private authService: AuthService,
    private apiHttpService: ApiHttpService,
    private browserService: BrowserService,
    private addonTranslator: AddOnTranslationService
    ) {
    this.activePageLookingFors = null;
    this.iriRoot = '';
    // gestion des changements de valeur pour this.nbItemsPerPage
    this.nbIPPChanged.pipe(
      debounceTime(400), // wait 400ms after the last change event before emitting last event
      distinctUntilChanged() // only emit if value is different from previous value
    ).subscribe(ippValue => {
      // console.log('[DEBUG] IPP last changed ', ippValue, typeof ippValue);
      this.nbItemsPerPage = ippValue;
      this.pageActive = 1;
      this.removeActiveStylesForCurrentItem();
      this.changeSelectedItemNewPageActive();
      this.browserService.setLocalStorageItem(this.getKeyIPP(), this.nbItemsPerPage);
    });
    // changements de valeur pour une checkbox constituant le filtre
    this.filterChanged.pipe(
      debounceTime(400),
      distinctUntilChanged()
    ).subscribe(wrapCriteria => {
      // console.log('[DEBUG] Filter bool criteria last changed', wrapCriteria);
      switch (wrapCriteria.filterIndex) {
        case 1:
          this.filter.onlyActive = wrapCriteria.filterValue;
          this.removeActiveStylesForCurrentItem();
          this.applyFilter();
          break;
        default:
          console.warn(`Filter changed index not expected: ${wrapCriteria.filterIndex}. `, wrapCriteria);
      }
    });
  }

  ngOnInit(): void {
    this.pageActive = 0;
    if (this.address) {
      this.iriRoot = this.apiHttpService.getIriRootFromUserIri(this.address.user);
      this.getLookingForsFromAddress();
    }
    this.locale = this.addonTranslator.getDeterminedLocale();

    const storedFilter = this.address ? this.browserService.getLocalStorageSerializable(this.getKeyFilter()) : null;
    if (storedFilter) {
      this.filter = storedFilter;
    } else {
      this.filter = {
        onlyActive: false
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

  getLookingForsFromAddress(): void {
    this.dataLoading = true;
    // récupérer les items LookingFor enregistrés pour l'adresse
    this.apiHttpService.getAddressLookingFors(this.address)
      .subscribe((addressLookingFors: LookingFor[]) => {
        this.unfilteredLookingFors = addressLookingFors;
        if (this.unfilteredLookingFors.length) {
          this.applyFilter();
        }
        this.dataLoading = false;
        // console.log('[DEBUG] getAddressLookingFors - 1 ', addressLookingFors.length);
      }, (error) => {
        // console.warn('[API] getAddressLookingFors - 9 ', error);
        this.warningMessage = error.errorMessage;
        this.showWarningMessage = true;
        this.dataLoading = false;
        of(keyEnsureErrorDisplay).pipe(delay(2500)).subscribe(value => {
          this.authService.checkTokenExpiration(error, 1000, true);
        });
      });
  }

  applyFilter(changeSelected: boolean = true): void {
    // build this.addressLookingFors from this.unfilteredLookingFors, applying current filter (this.filter)
    let filteredLookingFors = [];

    if (this.filter.onlyActive) {
      filteredLookingFors = this.unfilteredLookingFors.filter((item: LookingFor) => {
        return item.active;
      });
    } else {
      // all items are selected
      filteredLookingFors = this.unfilteredLookingFors;
    }

    this.addressLookingFors = filteredLookingFors;

    if (this.addressLookingFors.length) {
      this.pageActive = 1;
    } else {
      this.selectedLookingForId = '';
      this.pageActive = 0;
    }

    if (changeSelected) {
      this.changeSelectedItemNewPageActive();

      this.browserService.setLocalStorageSerializable(this.getKeyFilter(), this.filter);
    }
  }

  getKeyFilter(): string {
    const keyPrefix = 'filter_alf_';
    return keyPrefix + this.address.id;
  }

  getKeyIPP(): string {
    return 'nb_ipp_alf';
  }

  filterNotAllSelected(): boolean {
    return (this.unfilteredLookingFors && this.addressLookingFors && this.unfilteredLookingFors.length !== this.addressLookingFors.length);
  }

  queueChangeFilter(checkBoxEvent: any, index: number) {
    this.filterChanged.next({filterIndex: index, filterValue: checkBoxEvent.target.checked});
  }

  queueChangeIPP(newValueIPP: number) {
    this.nbIPPChanged.next(newValueIPP);
  }


  totalPagesNumberFromList(baseListItems: LookingFor[], numberItemsToDisplay: number = null): number {
    if (numberItemsToDisplay === null) {
      numberItemsToDisplay = baseListItems ? baseListItems.length : 0;
    }
    const nbLast = numberItemsToDisplay % this.nbItemsPerPage; // reste de la division entière
    let nbPages = parseInt((numberItemsToDisplay / this.nbItemsPerPage).toPrecision(), 10); // nombre de pages "complètes"
    if (nbLast) {
      nbPages++; // la dernière page est "incomplète"
    }
    return nbPages;
  }

  totalPagesNumber(numberItemsToDisplay: number = null): number {
    return this.totalPagesNumberFromList(this.addressLookingFors, numberItemsToDisplay);
  }

  getPages(): number[] {
    const pages = [];
    const nbPages = this.totalPagesNumber();
    for (let i = 1; i <= nbPages; i++) {
      pages.push(i);
    }
    return pages;
  }

  getPageLookingFors(): LookingFor[] {
    if (!this.addressLookingFors || !this.addressLookingFors.length) {
      return [];
    }

    // gestion de la pagination dans la liste
    const pageLookingFors = [];
    const nbItems = this.addressLookingFors.length;
    const nbLast = nbItems % this.nbItemsPerPage; // reste de la division entière
    const nbPages = this.totalPagesNumber(nbItems);
    if (!this.pageActive || this.pageActive > nbPages) {
      this.pageActive = 1;
    }
    // constituer pageLookingFors avec les éléments de this.addressLookingFors correspondant à this.pageActive
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
      if (this.addressLookingFors[i].id === this.selectedLookingForId) {
        foundCurrentSelected = true;
      }
      pageLookingFors.push(this.addressLookingFors[i]);
    }
    if (!foundCurrentSelected) {
      this.selectedLookingForId = this.addressLookingFors[firstIndex] ? this.addressLookingFors[firstIndex].id : '';
    }

    return pageLookingFors;
  }

  changeSelectedItemNewPageActive(itemDefaultSelection: boolean = true): void {
    this.activePageLookingFors = null;
    if (this.pageActive) {
      this.activePageLookingFors = this.getPageLookingFors();

      of(keyWaitForDomAvailable).pipe(delay(90)).subscribe(value => {
        // après temporisation
        this.keyManager = new FocusKeyManager(this.listItems).withWrap();

        if (itemDefaultSelection && this.keyManager) {
          // sélectionner par défaut le premier item visible
          this.keyManager.setFirstItemActive();
          this.updateSelectedLookingForId();
        }
      });
    }
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

  removeActiveStylesForCurrentItem(): void {
    if (this.keyManager && this.keyManager.activeItem) {
      // enlever le style "actif" sur l'actuel
      this.keyManager.activeItem.setInactiveStyles();
    }
  }

  selectListItem(index): void {
    if (this.keyManager) {
      this.removeActiveStylesForCurrentItem();
      this.keyManager.setActiveItem(index);
      this.updateSelectedLookingForId();
    }
  }

  onKeydown(event) {
    if (!this.keyManager) {
      return false;
    }

    if (event.keyCode === ENTER) {
      // console.log('[DEBUG] onKeydown(event) ENTER ', this.keyManager.activeItem);
      this.updateLookingFor();

    } else {
      if (event.keyCode === UP_ARROW || event.keyCode === DOWN_ARROW) {
        if (this.keyManager.activeItem) {
          // enlever le style "actif" sur l'actuel
          this.keyManager.activeItem.setInactiveStyles();
        }

        // passing the event to key manager so we get a change fired
        this.keyManager.onKeydown(event);

        this.updateSelectedLookingForId();
      }
    }
  }

  updateSelectedLookingForId(): void {
    if (this.keyManager && this.keyManager.activeItem) {
      // set new selected LookingFor
      this.selectedLookingForId =  this.keyManager.activeItem.itemLookingFor.id;
    }
  }

  /*--
  // put the focus on the current selected item
  putFocusOnCurrentSelected() {
    if (isPlatformBrowser(this.platformId) && this.keyManager && this.keyManager.activeItem) {
      // console.log('[DEBUG] putFocusOnCurrentSelected() - document.activeElement ', this.document.activeElement);
      const targetFocus = dataAttrIdPrefix + this.keyManager.activeItem.itemPlace.id;
      const targetElement = this.document.getElementById(targetFocus);
      const currentFocus = this.document.activeElement.getAttribute(dataAttrIdPlace);
      if (currentFocus !== targetFocus && targetElement) {
        // console.log('[DEBUG] putFocusOnCurrentSelected() - ElementById(targetFocus).click ! ', targetFocus);
        targetElement.click();
      }
    }
  }
  --*/

  doShowList(): void {
    this.showForm = false;
    this.showList = true; // switch to list
    this.backOnKeyManagedList();
  }

  doShowForm(): void {
    this.saveKeyManagedListStatus();
    this.showList = false;
    this.showForm = true; // switch to form
  }

  saveKeyManagedListStatus(): void {
    this.pageActiveSwitch = this.pageActive;
    this.activePlaceItemIndex = this.keyManager ? this.keyManager.activeItemIndex : null;
    // console.log('[DEBUG] saveKeyManagedListStatus() ', this.pageActiveSwitch, this.activePlaceItemIndex);
    this.keyManager = null;
  }

  backOnKeyManagedList(): void {
    if (this.pageActiveSwitch) {
      // console.log('[DEBUG] backOnKeyManagedList() ', this.pageActiveSwitch, this.activePlaceItemIndex);
      this.pageActive = this.pageActiveSwitch;
      const hasLastItemIndex = (this.activePlaceItemIndex !== null);
      this.changeSelectedItemNewPageActive(); // (!hasLastItemIndex);

      of(keyWaitForDomAvailable).pipe(delay(90)).subscribe(value => {
        // console.log('[DEBUG] backOnKeyManagedList() - suite (a) ', this.keyManager.activeItemIndex, this.activePlaceItemIndex);
        if (hasLastItemIndex && this.keyManager && this.keyManager.activeItemIndex !== this.activePlaceItemIndex) {
          // sélectionner à nouveau le dernier item sélectionné
          this.removeActiveStylesForCurrentItem();
          this.keyManager.setActiveItem(this.activePlaceItemIndex);
          // console.log('[DEBUG] backOnKeyManagedList() - suite (b) ', this.keyManager.activeItemIndex);
          this.updateSelectedLookingForId();
        }
      });
    }
  }


  updateLookingFor(): void {
    const targetLookingFor = this.addressLookingFors.filter((item) => {
      return item.id && item.id === this.selectedLookingForId;
    });
    if (targetLookingFor.length === 1 && typeof targetLookingFor[0] === 'object') {
      this.lookingForToForm = cloneDeep(targetLookingFor[0]); // object deep copy (with lodash's method)

      this.doShowForm();
    }
  }

  addLookingForAllowed(): boolean {
    return !this.apiHttpService.isOffline();
  }

  addLookingFor(): void {
    if (this.addLookingForAllowed()) {
      // ajout d'un item LookingFor
      let addressIri = `${this.iriRoot}${addressApiGen}${this.address.id}`; // IRI de l'adresse propriétaire
      // initialiser un nouveau LookingFor
      this.lookingForToForm = new LookingFor('', addressIri, 'now', '');
      this.doShowForm();
    }
  }

  backToParent(): void {
    this.closeChildComponent.emit(true);
  }

  comeBackToList(isBackAfterRemoval: boolean): void {
    // comes from FormLookingForComponent
    this.doShowList(); // hide form

    if (isBackAfterRemoval) {
      this.successMessage = 'Individual.form.lookingFor.action.remove.success';
      this.showSuccessMessage = true;
      // recharger les messages pour avoir la bonne liste
      this.unfilteredLookingFors = [];
      this.addressLookingFors = [];
      this.getLookingForsFromAddress();
    }
  }

  lookingForChanges(lookingForItem: LookingFor): void {
    // comes from FormLookingForComponent after validation
    const lookingForIndex = this.unfilteredLookingFors.findIndex((item) => {
      return item.id && item.id === lookingForItem.id;
    });

    if (lookingForIndex !== -1) {
      // modification d'un message existant
      this.unfilteredLookingFors[lookingForIndex] = cloneDeep(lookingForItem); // object deep copy (with lodash's method)
      this.applyFilter();
    } else {
      // ajout d'un nouveau message -- this.unfilteredLookingFors.push(lookingForItem);
      this.addressLookingFors = [];
      this.getLookingForsFromAddress();
    }
    this.successMessage = 'Individual.form.lookingFor.action.post.success';
    this.showSuccessMessage = true;

    this.doShowList();
  }

}
