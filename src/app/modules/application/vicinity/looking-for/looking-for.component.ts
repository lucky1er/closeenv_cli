import { Component, OnInit, Input, Output, EventEmitter, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { of, Subject } from 'rxjs';
import { delay, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { FocusKeyManager } from '@angular/cdk/a11y';
import { UP_ARROW, DOWN_ARROW } from '@angular/cdk/keycodes';
import { NgbModal, NgbModalOptions, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { BrowserService } from 'src/app/modules/general/service/browser.service';
import { AddOnTranslationService } from 'src/app/modules/general/service/addOn.translation.service';
import { LookingFor } from 'src/app/model/lookingFor';
import { ListItemLookingForComponent } from './list-item.component';
import { Answer } from 'src/app/model/answer';

const defaultItemsPerPage = 10;
const keyWaitForDomAvailable = 'ensure-dom-availability';
//const keyEnsureErrorDisplay = 'ensure-error-display';
const userApiGen = '/api/users/';
const lookingForApiGen = '/api/looking_fors/';

@Component({
  selector: 'app-looking-for',
  templateUrl: './looking-for.component.html',
  styleUrls: ['./looking-for.component.css']
})
export class LookingForComponent implements OnInit {

  // Accessing multiple native DOM elements using QueryList
  @ViewChildren('listItems') listItems: QueryList<ListItemLookingForComponent>;
  @ViewChild('modalAnswer') modalAnswer: any;

  @Input() unfilteredLookingFors: LookingFor[];
  @Input() currentUserId: string;
  @Input() iriRoot: string;

  locale: string;
  vicinityLookingFors: LookingFor[]; // after applying the filter
  activePageLookingFors: LookingFor[]; // items list into the current page view
  lookingForToFormAnswer: LookingFor;
  pageActive: number; // pagination
  nbItemsPerPage = defaultItemsPerPage;
  nbIPPChanged: Subject<number> = new Subject<number>();
  filterChanged: Subject<any> = new Subject<any>();
  filter: any;
  selectedLookingForId = '';
  successMessage = '';
  showSuccessMessage = false;
  keyManager: FocusKeyManager<ListItemLookingForComponent>;
  modalOptions: NgbModalOptions;
  answerModalOpenRef: NgbModalRef;

  constructor(
    private modalService: NgbModal,
    private browserService: BrowserService,
    private addonTranslator: AddOnTranslationService
    ) {
    this.activePageLookingFors = null;
    this.answerModalOpenRef = null;
    this.modalOptions = {
      backdrop: 'static',
      backdropClass: 'customBackdrop'
    };
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
          this.filter.notShowUnwanted = wrapCriteria.filterValue;
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
    this.locale = this.addonTranslator.getDeterminedLocale();
    // console.log('[DEBUG] trace locale 4 ', this.locale);
    const storedFilter = this.browserService.getLocalStorageSerializable(this.getKeyFilter());
    if (storedFilter) {
      this.filter = storedFilter;
    } else {
      this.filter = {
        notShowUnwanted: true
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

    if (this.unfilteredLookingFors && this.unfilteredLookingFors.length) {
      this.applyFilter();
    }
  }

  applyFilter(changeSelected: boolean = true): void {
    // build this.vicinityLookingFors from this.unfilteredLookingFors, applying current filter (this.filter)
    let filteredLookingFors = [];

    if (this.filter.notShowUnwanted) {
      filteredLookingFors = this.unfilteredLookingFors.filter((item: LookingFor) => {
        return !item.isUserUnwanted;
      });
    } else {
      // all items are selected
      filteredLookingFors = this.unfilteredLookingFors;
    }

    this.vicinityLookingFors = filteredLookingFors;

    if (this.vicinityLookingFors.length) {
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

  queueChangeFilter(checkBoxEvent: any, index: number) {
    this.filterChanged.next({filterIndex: index, filterValue: checkBoxEvent.target.checked});
  }

  queueChangeIPP(newValueIPP: number) {
    this.nbIPPChanged.next(newValueIPP);
  }

  getKeyFilter(): string {
    return 'filter_vlf';
  }

  getKeyIPP(): string {
    return 'nb_ipp';
  }

  filterNotAllSelected(): boolean {
    return (
      this.unfilteredLookingFors && this.vicinityLookingFors && this.unfilteredLookingFors.length !== this.vicinityLookingFors.length
    );
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
    return this.totalPagesNumberFromList(this.vicinityLookingFors, numberItemsToDisplay);
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
    if (!this.vicinityLookingFors || !this.vicinityLookingFors.length) {
      return [];
    }

    // gestion de la pagination dans la liste
    const pageLookingFors = [];
    const nbItems = this.vicinityLookingFors.length;
    const nbLast = nbItems % this.nbItemsPerPage; // reste de la division entière
    const nbPages = this.totalPagesNumber(nbItems);
    if (!this.pageActive || this.pageActive > nbPages) {
      this.pageActive = 1;
    }
    // constituer pageLookingFors avec les éléments de this.vicinityLookingFors correspondant à this.pageActive
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
      if (this.vicinityLookingFors[i].id === this.selectedLookingForId) {
        foundCurrentSelected = true;
      }
      pageLookingFors.push(this.vicinityLookingFors[i]);
    }
    if (!foundCurrentSelected) {
      this.selectedLookingForId = this.vicinityLookingFors[firstIndex] ? this.vicinityLookingFors[firstIndex].id : '';
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

  updateSelectedLookingForId(): void {
    if (this.keyManager && this.keyManager.activeItem) {
      // set new selected LookingFor
      this.selectedLookingForId =  this.keyManager.activeItem.itemLookingFor.id;
    }
  }

  openAnswerModal(selectedLookingFor: LookingFor): void {
    let specModalOptions = { ...this.modalOptions };
    specModalOptions.size = 'lg';
    specModalOptions.windowClass = 'modal-xxl';
    specModalOptions.scrollable = true;
    this.lookingForToFormAnswer = selectedLookingFor;
    // console.log('[DEBUG] openAnswerModal - 1 ', selectedLookingFor);
    if (!selectedLookingFor.answer || !selectedLookingFor.answer.id) {
      let userIri = `${this.iriRoot}${userApiGen}${this.currentUserId}`; // IRI du user propriétaire
      let lookingForIri = `${this.iriRoot}${lookingForApiGen}${selectedLookingFor.id}`; // IRI du LookingFor
      // passer ces 2 IRI dans la réponse à créer
      selectedLookingFor.answer = new Answer('', userIri, lookingForIri, 'now');
    }

    this.answerModalOpenRef = this.modalService.open(this.modalAnswer, specModalOptions);
    this.answerModalOpenRef.result.then((result) => {
      // console.log('[MODAL]  then() ', result);
    }, (reason) => {
      // dismiss
      this.answerModalOpenRef = null;
    });
  }

  lookingForAnswerValidated(savedAnswer: Answer, answeredLookingFor: LookingFor): void {
    // console.log('[DEBUG] lookingForAnswerValidated - 1 ', savedAnswer, answeredLookingFor);
    this.successMessage = 'Individual.vicinity.form.answer.action.post.success';
    this.showSuccessMessage = true;
    // mettre à jour answeredLookingFor.answer pour raffraichir la vue
    answeredLookingFor.answer = savedAnswer;
    // fermer la modale
    if (this.answerModalOpenRef) {
      this.answerModalOpenRef.close('close');
    }
  }

  comeBackToList(isBackAfterRemoval: boolean, closedLookingFor: LookingFor): void {
    // console.log('[DEBUG] comeBackToList - 1 ', closedLookingFor);
    if (isBackAfterRemoval) {
      this.successMessage = 'Individual.vicinity.form.answer.action.remove.success';
      this.showSuccessMessage = true;
      // recharger / raffraichir la vue
      closedLookingFor.answer = null;
    }
    // fermer la modale
    if (this.answerModalOpenRef) {
      this.answerModalOpenRef.close('close');
    }
  }
}
