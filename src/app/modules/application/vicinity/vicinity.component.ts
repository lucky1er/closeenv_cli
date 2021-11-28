import { Component, OnInit, Inject, PLATFORM_ID, ViewChild, QueryList, ViewChildren } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { isPlatformBrowser, DOCUMENT } from '@angular/common';
import { FocusKeyManager } from '@angular/cdk/a11y';
import { ENTER, UP_ARROW, DOWN_ARROW } from '@angular/cdk/keycodes';
import { of, Subject } from 'rxjs';
import { delay, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { NgbModal, NgbModalOptions, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import cloneDeep from 'lodash-es/cloneDeep';

import { ApiHttpService } from '../../general/service/api.http.service';
import { BrowserService } from '../../general/service/browser.service';
import { AppConfigService } from 'src/app/app.config.service';
import { MapComponentService } from 'src/app/modules/general/map/map.component.service';
import { AuthService } from '../../general/service/auth.service';
import { AddOnTranslationService } from '../../general/service/addOn.translation.service';
import { User } from 'src/app/model/user';
import { Address } from 'src/app/model/address';
import { LookingFor } from 'src/app/model/lookingFor';
import { Category } from 'src/app/model/category';
import { Place, assoCategoryCode, keyFromSpecificSearch, placeDefaultOrder, tempIdPrefix } from 'src/app/model/place';
// https://developer.here.com/documentation/places/dev_guide/topics/place_categories/places-category-system.html
// https://places.cit.api.here.com/places/v1/autosuggest?q=vente&in=47.4412000%2C-1.6434900%3Br%3D50000&result_types=category&cs=pds
//    &Accept-Language=fr%2Cfr-FR%3Bq%3D0.8%2Cen-US%3Bq%3D0.5%2Cen%3Bq%3D0.3&app_id=DemoAppId01082013GAL&app_code=AJKnXv84fjrb0KIHawS0Tg
// https://places.cit.api.here.com/places/v1/browse?in=47.4412000%2C-1.6434900%3Br%3D50000&result_types=place&cs=pds
//    &Accept-Language=fr%2Cfr-FR%3Bq%3D0.8%2Cen-US%3Bq%3D0.5%2Cen%3Bq%3D0.3&app_id=DemoAppId01082013GAL&app_code=AJKnXv84fjrb0KIHawS0Tg
// https://places.cit.api.here.com/places/v1/discover/explore?in=47.4412000%2C-1.6434900%3Br%3D50000&size=40&cs=pds
//    &Accept-Language=fr%2Cfr-FR%3Bq%3D0.8%2Cen-US%3Bq%3D0.5%2Cen%3Bq%3D0.3&app_id=DemoAppId01082013GAL&app_code=AJKnXv84fjrb0KIHawS0Tg
import categoryHeaders from 'src/assets/params/json/categ-headers.json';
import { PlaceItemComponent } from './place-item.component';

const defaultItemsPerPage = 10;
const dataAttrIdPlace = 'id';
const dataAttrIdPrefix = 'i-';
const keyEnsureErrorDisplay = 'ensure-error-display';
const keyWaitForDomAvailable = 'ensure-dom-availability';

@Component({
  selector: 'app-vicinity',
  templateUrl: './vicinity.component.html',
  styleUrls: ['./vicinity.component.css']
})
export class VicinityComponent implements OnInit {

  @ViewChildren('itemPlace') listItems: QueryList<PlaceItemComponent>;
  @ViewChild('modalSpecificSearch') modalSpecificSearch: any;

  activeListType = 1;
  baseCategories: Category[] = null;
  individualsLookingFors: LookingFor[];
  idAddress: string;
  coordsAddress: Address;
  nbBaseLinkedPlaces: number;
  userConnected: User = null;
  currentUserId: string;
  iriRoot: string;
  pageActive: number; // pagination
  filterCategories: any[];
  unfilteredPlaces: Place[]; // before applying the filter
  places: Place[]; // after applying the filter
  activePagePlaces: Place[]; // places list into the current page view
  placeToForm: Place;
  selectedPlaceId = '';
  placesUpToDate = true;
  placesSaving = false;
  loading = true;
  showList = true;
  showForm = false;
  showMap = false;
  warningMessage = '';
  showWarningMessage = false;
  successMessage = '';
  showSuccessMessage = false;
  infoMessage = '';
  showInfoMessage = false;
  maxTopOrder = 20;
  nbItemsPerPage = defaultItemsPerPage;
  nbIPPChanged: Subject<number> = new Subject<number>();
  filterChanged: Subject<any> = new Subject<any>();
  keyManager: FocusKeyManager<PlaceItemComponent>;
  activePlaceItemIndex: number;
  pageActiveSwitch: number;
  modalOptions: NgbModalOptions;
  searchModalOpenRef: NgbModalRef;
  lastSearchCriteria: string;

  constructor(
    private router: Router,
    private actRoute: ActivatedRoute,
    private modalService: NgbModal,
    private apiHttpService: ApiHttpService,
    private browserService: BrowserService,
    private mapService: MapComponentService,
    private configService: AppConfigService,
    public addonTranslator: AddOnTranslationService,
    @Inject(DOCUMENT) private document: Document,
    @Inject(PLATFORM_ID) private platformId: object,
    private authService: AuthService) {

    this.individualsLookingFors = [];
    this.activePlaceItemIndex = null;
    this.activePagePlaces = null;
    this.searchModalOpenRef = null;
    this.lastSearchCriteria = '';
    this.idAddress = actRoute.snapshot.params.idAddress;
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
      if (this.nbItemsPerPage !== ippValue) {
        this.nbItemsPerPage = ippValue;
        this.browserService.setLocalStorageItem(this.getKeyIPP(), this.nbItemsPerPage);
        this.applyFilter();
      }
    });
    // changements de valeur pour une des checkboxes constituant le filtre
    this.filterChanged.pipe(
      debounceTime(400),
      distinctUntilChanged()
    ).subscribe(wrapCriteria => {
      if (this.filterCategories[wrapCriteria.filterIndex]) {
        // console.log('[DEBUG] Filter bool criteria last changed', wrapCriteria, this.filterCategories[wrapCriteria.filterIndex]);
        this.filterCategories[wrapCriteria.filterIndex].selected = wrapCriteria.filterValue;
        this.applyFilter();
      }
    });
  }

  ngOnInit(): void {
    if (!this.authService.activeUserSubscription) {
      this.router.navigate(['/']);
    } else {
      this.coordsAddress = null;
      this.nbBaseLinkedPlaces = 0;
      this.pageActive = 0;
      this.userConnected = this.authService.userConnected;
      if (this.userConnected) {
        this.currentUserId = this.apiHttpService.getIdFromIri(this.userConnected.iri);
        this.iriRoot = this.apiHttpService.getIriRootFromUserIri(this.userConnected.iri);
      } else {
        this.currentUserId = null;
        this.iriRoot = null;
      }

      this.apiHttpService.connectivityChecking()
      .subscribe(connectivityResult => {
        // online or offline, go on...
        this.getClosePlaces();
        this.getIndividualsLookingFors();
      });

      const storedSearch = this.browserService.getLocalStorageSerializable(this.getKeySearch());
      const storedFilter = this.browserService.getLocalStorageSerializable(this.getKeyFilter());
      const lastoredIPP = this.browserService.getLocalStorageItem(this.getKeyIPP());
      if (lastoredIPP) {
        const numberIPP = parseInt(lastoredIPP, 10);
        if (!isNaN(numberIPP)) {
          this.nbItemsPerPage = numberIPP;
        }
      }
      if (storedSearch && storedSearch.hasOwnProperty('code')) {
        this.lastSearchCriteria = storedSearch.code;
      }

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

      this.filterCategories = categoryHeaders.map(item => {
        const storedFilterItem = storedFilter && storedFilter.length ? storedFilter.find(el => el.code === item.code) : null;
        const isItemSelected = storedFilterItem ? storedFilterItem.selected : true;
        // add 'label' property with translated label for head of category
        return { code: item.code, label: this.addonTranslator.getOriginalTranslation(item.label), selected: isItemSelected };
      });
    }
  }

  isOfflineMode(): boolean {
    return this.apiHttpService.isOffline();
  }

  addPlaceAllowed(): boolean {
    return !this.apiHttpService.isOffline();
  }

  updatePlaceAllowed(): boolean {
    return (!this.apiHttpService.isOffline() && this.selectedPlaceId !== '');
  }

  savePlacesDisabled(): boolean {
    return (this.apiHttpService.isOffline() || this.placesUpToDate);
  }

  listProfessionals(): boolean {
    return (this.activeListType === 1);
  }

  listIndividuals(): boolean {
    return (this.activeListType === 2);
  }

  changeActiveListType(newActiveListType: number) {
    this.activeListType = newActiveListType;
  }

  getKeyFilter(): string {
    const keyPrefix = 'filter_';
    return keyPrefix + this.idAddress;
  }

  getKeyIPP(): string {
    return 'nb_ipp';
  }

  getKeySearch(): string {
    const keyPrefix = 'search_';
    return keyPrefix + this.idAddress;
  }

  getLabelAddress(): string {
    return this.coordsAddress ? this.coordsAddress.addressLabel : '...';
  }

  getIndividualsLookingFors(): void {
    // charger les individualsLookingFors
    this.apiHttpService.getVicinityLookingFors(this.idAddress)
      .subscribe((lookingFors: LookingFor[]) => {
        this.individualsLookingFors = lookingFors;
        // console.log('[DEBUG] getLookingFors - 1 ', this.individualsLookingFors);
      }, (error) => {
        // console.warn('[API] getLookingFors - 9 ', error);
        of(keyEnsureErrorDisplay).pipe(delay(2500)).subscribe(value => {
          this.authService.checkTokenExpiration(error, 1000, true);
        });
      });
  }

  getClosePlaces() {
    // récupérer les coordonnées de l'adresse correspondant à this.idAddress
    this.apiHttpService.getAddress(this.idAddress)
      .subscribe((address: Address) => {
        if (!address.latitude || !address.longitude) {
          this.warningMessage = 'Member.address.location.imprecise';
          this.showWarningMessage = true;
          this.loading = false;
          return ;
        }
        this.coordsAddress = address;
        this.nbBaseLinkedPlaces = address.nbLinkedPlaces;

        if (address.nbLinkedPlaces) {
          this.placesUpToDate = true;
          this.getSavedPlaces(); // places liées déjà enregistrées en base
        } else {
          this.getPotentialPlaces();
        }

      }, (error) => {
        // console.warn('[DEBUG] VicinityComponent, getClosePlaces - n1-9 ', error);
        this.warningMessage = error.errorMessage;
        this.showWarningMessage = true;
        this.loading = false;
        of(keyEnsureErrorDisplay).pipe(delay(2500)).subscribe(value => {
          this.authService.checkTokenExpiration(error, 1000, true);
        });
      });
    //
  }

  getSavedPlaces(): void {
    // récupérer les places déjà enregistrées en base
    this.apiHttpService.getLinkedPlaces(this.idAddress)
      .subscribe((linkedPlaces: Place[]) => {
        this.unfilteredPlaces = linkedPlaces;
        if (this.unfilteredPlaces.length < this.configService.config.heerApiLimit) {
          // check other places from away
          this.apiHttpService.getClosePlacesFromCoords(this.coordsAddress)
            .subscribe((fromAwayPlaces: Place[]) => {
              if (fromAwayPlaces.length) {
                // ajout de places from away pas encore enregistrée (inconnue from base)
                this.completeUnfilteredListWithPlaces(fromAwayPlaces);
              }
            }, (error) => {
              // rien à faire
            }, () => {
              // fin du subscribe
              this.afterPlacesLoading();
            });
        } else {
          this.afterPlacesLoading();
        }
        // console.log('[DEBUG] VicinityComponent, getSavedPlaces - 1 ', linkedPlaces.length);
      }, (error) => {
        // console.warn('[DEBUG] VicinityComponent, getSavedPlaces - 9 ', error);
        this.warningMessage = error.errorMessage;
        this.showWarningMessage = true;
        this.loading = false;
        of(keyEnsureErrorDisplay).pipe(delay(2500)).subscribe(value => {
          this.authService.checkTokenExpiration(error, 1000, true);
        });
      });
    //
  }

  getPotentialPlaces(): void {
    // deux requêtes http en parallèle...
    this.apiHttpService.getPotentialPlaces(this.idAddress, true, this.coordsAddress)
      .subscribe(([respFromBase, respFromAway]) => {
        this.unfilteredPlaces = []; // respFromAway;
        if (respFromBase.length) {
          let tempListPlaces = [];
          for (const basePlace of respFromBase) {
            const placeCoords = { latitude: basePlace.positionLat, longitude: basePlace.positionLng };
            // calculer la distance entre this.coordsAddress et placeCoords
            const estimatedDistance = this.mapService.getDistanceBetweenTwoPoints(this.coordsAddress, placeCoords);
            if (estimatedDistance < this.configService.config.heerApiRadius) {
              basePlace.distance = estimatedDistance;
              basePlace.orderInList = placeDefaultOrder;
              basePlace.flags = [];
              if (!basePlace.categories || !basePlace.categories.length) {
                basePlace.userInitiative = true;
              }
              // console.log('[DEBUG] Place ajoutée "fromBase" ', basePlace);
              tempListPlaces.push(basePlace);
            }
          }
          if (tempListPlaces.length) {
            // trier tempListPlaces / distance
            tempListPlaces.sort(Place.sortByOrderDistance);
            // limiter la taille de tempListPlaces à {config.heerApiLimit} éléments
            const removedItems = tempListPlaces.splice(this.configService.config.heerApiLimit);
          }
          this.unfilteredPlaces = tempListPlaces;
        }
        if (this.unfilteredPlaces.length < this.configService.config.heerApiLimit && respFromAway.length) {
          // ajout de places from away pas encore enregistrée (inconnue from base)
          this.completeUnfilteredListWithPlaces(respFromAway);
        }

        this.afterPlacesLoading();
        // this.placesUpToDate = false; // cf. savePlaces qui suit
        this.savePlaces(false); // lancer automatiquement un save pour une meilleure gestion des "nearBy Users"

        // console.log('[DEBUG] VicinityComponent, getPotentialPlaces - 1 ', filteredPlaces.length);
      }, (error) => {
        // console.warn('[DEBUG] VicinityComponent, getPotentialPlaces - 9 ', error);
        this.warningMessage = error.errorMessage;
        this.showWarningMessage = true;
      }, () => {
        // FIN du subscribe imbriqué
        this.loading = false;
      });
  }

  completeUnfilteredListWithPlaces(otherPlaces: Place[]): void {
    for (const aPlace of otherPlaces) {
      const placeIndex = this.unfilteredPlaces.findIndex((item) => {
        return item.title && (Place.normalizedStringsEquality(item.title, aPlace.title)
          || item.address === aPlace.address);
      });
      if (placeIndex === -1) {
        this.unfilteredPlaces.push(aPlace);
        if (this.unfilteredPlaces.length >= this.configService.config.heerApiLimit) {
          break; // on a atteint le max, inutile en traiter la suite de otherPlaces
        }
      }
    }
  }

  afterPlacesLoading(): void {
    if (this.unfilteredPlaces.length) {
      this.unfilteredPlaces.sort(Place.sortByOrderDistance);
      this.cleanCategories(this.unfilteredPlaces);
      this.applyFilter();
    }
    this.loading = false;
  }

  cleanCategories(places: Place[]): void {
    if (this.filterCategories.length) {
      const typeC = [
        this.filterCategories.length > 0 ? this.filterCategories[0].code : null,
        this.filterCategories.length > 1 ? this.filterCategories[1].code : null,
        this.filterCategories.length > 2 ? this.filterCategories[2].code : null,
        this.filterCategories.length > 3 ? this.filterCategories[3].code : null,
        this.filterCategories.length > 4 ? this.filterCategories[4].code : null,
      ];
      for (const place of places) {
        const relevantList = place.categories.filter(categ =>
          categ === assoCategoryCode ||
          (typeC[0] && categ.startsWith(typeC[0])) ||
          (typeC[1] && categ.startsWith(typeC[1])) ||
          (typeC[2] && categ.startsWith(typeC[2])) ||
          (typeC[3] && categ.startsWith(typeC[3])) ||
          (typeC[4] && categ.startsWith(typeC[4]))
        );
        if (relevantList.length !== place.categories.length) {
          // console.log('[DEBUG] cleanCategories(), ' + place.title + ' : from, to ', place.categories, relevantList);
          place.categories = relevantList;
        }
      }
    }
  }

  filterNotAllSelected(): boolean {
    return this.filterCategories ? (this.filterCategories.findIndex(hcateg => !hcateg.selected) !== -1) : false;
  }

  applyFilter(): void {
    // build this.places from this.unfilteredPlaces, applying current filter (this.filterCategories)
    let filteredPlaces = [];
    this.removeActiveStylesForCurrentItem();
    // console.log('[DEBUG] applyFilter(), avant filtrage ', this.unfilteredPlaces.length);
    if (this.filterNotAllSelected()) {
      // console.log('[DEBUG] Application Filtre ', this.filterCategories);
      const headCategSelected = this.filterCategories.filter(hcateg => hcateg.selected);
      if (headCategSelected.length) {
        filteredPlaces = this.unfilteredPlaces.filter((place: Place) => {
          if (place.categories.length) {
            let found = -1;
            for (const broadCateg of headCategSelected) {
              found = place.categories.findIndex(categ => categ.startsWith(broadCateg.code));
              if (found !== -1) {
                return true;
              }
            }
          }
          return false;
        });
      }
      // console.log('[DEBUG] applyFilter(), après filtrage ', filteredPlaces.length);
    } else {
      // console.log('[DEBUG] applyFilter(), aucun filtre ');
      // all heads of category are selected
      filteredPlaces = this.unfilteredPlaces;
    }

    this.places = filteredPlaces;
    if (this.places.length) {
      this.pageActive = 1;
    } else {
      this.selectedPlaceId = '';
      this.pageActive = 0;
    }
    this.changeSelectedItemNewPageActive();

    this.browserService.setLocalStorageSerializable(this.getKeyFilter(), this.filterCategories);
  }

  queueChangeFilter(checkBoxEvent: any, index: number) {
    this.filterChanged.next({filterIndex: index, filterValue: checkBoxEvent.target.checked});
  }

  queueChangeIPP(newValueIPP: number) {
    this.nbIPPChanged.next(newValueIPP);
  }

  savePlaces(userDisplay: boolean = true): void {
    if (this.apiHttpService.isOffline()) {
      return ;
    }
    // enregistrer les places en base
    if (userDisplay) {
      this.placesSaving = true;
    }
    this.infoMessage = '';
    this.showInfoMessage = false;
    // NB: this.places ne référence que les places après application du filtre
    // => toujours envoyer le périmètre complet (sans filtre), sinon pb recharchement au retour du post
    this.apiHttpService.postLinkedPlaces(this.idAddress, this.unfilteredPlaces)
      .subscribe((savedPlaces: Place[]) => {
        this.nbBaseLinkedPlaces = savedPlaces.length;
        this.placesUpToDate = true;
        this.placesSaving = false;
        if (userDisplay) {
          // show success message
          this.successMessage = 'Member.vicinity.list.save.success';
          this.showSuccessMessage = true;
        }
        // enchainer avec API GET pour assurer le raffraichissement du cache navigateur
        this.getSavedPlaces();
      }, (error) => {
        console.warn('[DEBUG] VicinityComponent, savePlaces() - 9 ', error);
        if (userDisplay) {
          this.warningMessage = error.errorMessage;
          this.showWarningMessage = true;
        }
        this.placesSaving = false;
        of(keyEnsureErrorDisplay).pipe(delay(2500)).subscribe(value => {
          this.authService.checkTokenExpiration(error, 1000, true);
        });
      });
    //
  }

  totalPagesNumberFromList(baseListPlaces: Place[], numberItemsToDisplay: number = null): number {
    if (numberItemsToDisplay === null) {
      numberItemsToDisplay = baseListPlaces ? baseListPlaces.length : 0;
    }
    const nbLast = numberItemsToDisplay % this.nbItemsPerPage; // reste de la division entière
    let nbPages = parseInt((numberItemsToDisplay / this.nbItemsPerPage).toPrecision(), 10); // nombre de pages "complètes"
    if (nbLast) {
      nbPages++; // la dernière page est "incomplète"
    }
    return nbPages;
  }

  totalPagesNumber(numberItemsToDisplay: number = null): number {
    return this.totalPagesNumberFromList(this.places, numberItemsToDisplay);
  }

  getPages(): number[] {
    const pages = [];
    const nbPages = this.totalPagesNumber();
    for (let i = 1; i <= nbPages; i++) {
      pages.push(i);
    }
    return pages;
  }

  whichPageNumberContainsTheIndex(baseListPlaces: Place[], itemIndex: number): number {
    const nbItems = baseListPlaces.length;
    const nbLast = nbItems % this.nbItemsPerPage; // reste de la division entière
    const nbPages = this.totalPagesNumberFromList(baseListPlaces, nbItems);
    let pageNumber = -1;

    for (let page = 1; page <= nbPages; page++) {
      const activeStartingFrom0 = page - 1;
      const firstIndex = activeStartingFrom0 * this.nbItemsPerPage;
      let lastIndex = firstIndex + this.nbItemsPerPage - 1;
      if (page === nbPages && nbLast) {
        lastIndex = firstIndex + nbLast - 1;
        if (lastIndex > (nbItems - 1)) {
          // ne devrait jamais arriver
          lastIndex = nbItems - 1;
        }
      }
      if (itemIndex >= firstIndex && itemIndex <= lastIndex) {
        pageNumber = page;
        break; // retourner ce numéro de page
      }
    } 

    return pageNumber;
  }

  getPagePlaces(): Place[] {
    if (!this.places || !this.places.length) {
      return [];
    }

    // gestion de la pagination dans liste des places
    const pagePlaces = [];
    const nbItems = this.places.length;
    const nbLast = nbItems % this.nbItemsPerPage; // reste de la division entière
    const nbPages = this.totalPagesNumber(nbItems);
    if (!this.pageActive || this.pageActive > nbPages) {
      this.pageActive = 1;
    }
    // constituer pagePlaces avec les éléments de this.places correspondant à this.pageActive
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
      if (this.places[i].id === this.selectedPlaceId) {
        foundCurrentSelected = true;
      }
      pagePlaces.push(this.places[i]);
    }
    if (!foundCurrentSelected) {
      this.selectedPlaceId = this.places[firstIndex] ? this.places[firstIndex].id : '';
    }

    return pagePlaces;
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

  changeSelectedItemNewPageActive(itemDefaultSelection: boolean = true): void {
    this.activePagePlaces = null;
    if (this.pageActive) {
      this.activePagePlaces = this.getPagePlaces();

      of(keyWaitForDomAvailable).pipe(delay(90)).subscribe(value => {
        // après temporisation
        this.keyManager = new FocusKeyManager(this.listItems).withWrap(); // .withHomeAndEnd();
        // this.keyManager.setFocusOrigin(null); // 'touch' | 'mouse' | 'keyboard' | 'program'

        if (itemDefaultSelection && this.keyManager) {
          // sélectionner par défaut le premier item visible
          this.keyManager.setFirstItemActive();
          this.updateSelectedPlaceId();
          // console.log('[DEBUG] changeSelectedItemNewPageActive(), selectedPlaceId ', this.selectedPlaceId);
          // if (this.keyManager.activeItem) {
          //   this.putFocusOnCurrentSelected();
          // }
        }
      });
    }
  }

  removeActiveStylesForCurrentItem(): void {
    if (this.keyManager && this.keyManager.activeItem) {
      // console.log('[DEBUG] on click on list-item... ', this.keyManager.activeItem.itemPlace.title);
      // enlever le style "actif" sur l'actuel
      this.keyManager.activeItem.setInactiveStyles();
    }
  }

  selectListItem(index): void {
    // console.log('[DEBUG] selectListItem() ', index, place);
    if (this.keyManager) {
      this.removeActiveStylesForCurrentItem();
      this.keyManager.setActiveItem(index);
      this.updateSelectedPlaceId();
    }
  }

  onKeydown(event) {
    if (!this.keyManager) {
      return false;
    }

    if (event.keyCode === ENTER) {
      // console.log('[DEBUG] onKeydown(event) ENTER ', this.keyManager.activeItem);
      this.updatePlace();

    } else {
      if (event.keyCode === UP_ARROW || event.keyCode === DOWN_ARROW) {
        //event.stopImmediatePropagation();
        //event.preventDefault();
        // console.log('[DEBUG] onKeydown(event) autre ', event);

        if (this.keyManager.activeItem) {
          // enlever le style "actif" sur l'actuel
          this.keyManager.activeItem.setInactiveStyles();
        }

        // passing the event to key manager so we get a change fired
        this.keyManager.onKeydown(event);

        this.updateSelectedPlaceId();
        //return false;
      }
    }
  }

  updateSelectedPlaceId(): void {
    if (this.keyManager && this.keyManager.activeItem) {
      // console.log('[DEBUG] onKeydown(event) - 1 ', event.keyCode, this.keyManager.activeItem.itemPlace.title);
      // set new selected Place
      this.selectedPlaceId =  this.keyManager.activeItem.itemPlace.id;
    }
  }

  // put the focus on the current selected item
  putFocusOnCurrentSelected() {
    if (isPlatformBrowser(this.platformId) && this.keyManager && this.keyManager.activeItem) {
      // console.log('[DEBUG] putFocusOnCurrentSelected() - document.activeElement ', this.document.activeElement);
      const targetFocus = dataAttrIdPrefix + this.keyManager.activeItem.itemPlace.id;
      const targetElement = this.document.getElementById(targetFocus);
      //if (targetElement) {
      //  console.log('[DEBUG] putFocusOnCurrentSelected() - targetElement ', targetElement);
      //  console.log('[DEBUG] putFocusOnCurrentSelected() - targetElement.tabindex ', targetElement.getAttribute('tabindex'));
      //}
      const currentFocus = this.document.activeElement.getAttribute(dataAttrIdPlace);
      if (currentFocus !== targetFocus && targetElement) {
        // console.log('[DEBUG] putFocusOnCurrentSelected() - ElementById(targetFocus).click ! ', targetFocus);
        targetElement.click();
      }
    }
  }

  getListCategories(place: Place): string {
    let listCategories = '';
    if (place.categories) {
      for (const categ of place.categories) {
        if (listCategories !== '') {
          listCategories += ',';
        }
        listCategories += categ;
      }
    }
    return listCategories;
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
          this.updateSelectedPlaceId();
        }
      });
    }
  }

  doShowList(): void {
    this.showForm = false;
    this.showMap = false;
    this.showList = true; // switch to list
    this.backOnKeyManagedList();
  }

  doShowForm(): void {
    this.saveKeyManagedListStatus();
    this.showList = false;
    this.showMap = false;
    this.showForm = true; // switch to form
  }

  doShowMap(): void {
    this.saveKeyManagedListStatus();
    this.showList = false;
    this.showForm = false;
    this.showMap = true; // switch to map
  }

  updatePlace(): void {
    const targetPlace = this.places.filter((item) => {
      return item.id && item.id === this.selectedPlaceId;
    });
    // console.log('[DEBUG] VicinityComponent - updatePlace() - 0 ', targetPlace, targetPlace.length, typeof targetPlace[0]);
    if (targetPlace.length === 1 && typeof targetPlace[0] === 'object') {
      this.placeToForm = cloneDeep(targetPlace[0]); // object deep copy (with lodash's method)

      if (this.placeToForm.popupMessage) {
        // comptabiliser une vue supplémentaire pour le message du commerce
        this.apiHttpService.viewShopMessage(this.idAddress, this.placeToForm)
          .subscribe((result) => {}, (error) => {});
      }

      this.doShowForm();
    }
  }

  addPlace(): void {
    // ajout d'une Place à suggérer (à l'initiative du user)
    const tempId = tempIdPrefix + this.unfilteredPlaces.length;
    // initialiser une Place avec un id temporaire, et le flag userInitiative à true
    this.placeToForm = new Place(tempId, '', 'user', '', 0, 0, 0, 0, 0, [], [], true, this.maxTopOrder);
    this.doShowForm();
  }

  placeChanges(place: Place): void {
    // comes from FormVicinityComponent after validation
    const placeIndex = this.unfilteredPlaces.findIndex((item) => {
      return item.id && item.id === place.id;
    });

    if (placeIndex !== -1) {
      // modification d'une place existante
      // targetPlace[0] = { ...place }; // recopie l'objet  [ autre technique possible: targetPlace[0] = Object.assign({}, place) ]
      this.unfilteredPlaces[placeIndex] = cloneDeep(place); // object deep copy (with lodash's method)
    } else {
      // ajout d'une nouvelle adresse
      this.unfilteredPlaces.push(place);
    }

    if (place.orderInList) {
      // vérifier l'unicité du numéro d'ordre dans la liste
      this.checkListOrderNumber(place);
      this.unfilteredPlaces.sort(Place.sortByOrderDistance);
    }
    this.applyFilter();
    // positioner le flag placesUpToDate pour indiquer qu'une sauvegarde est nécessaire (cf. bouton 'Enregistrer modifications')
    this.placesUpToDate = false;
    // afficher message d'info pour signaler à l'utilisateur qu'une sauvegarde serait nécessaire
    this.infoMessage = 'Member.vicinity.changes.needs.tobe.saved';
    this.showInfoMessage = true;
    if (this.showSuccessMessage) {
      this.successMessage = '';
      this.showSuccessMessage = false;
    }
    this.doShowList();
  }

  checkListOrderNumber(lastOrdered: Place): void {
    // given place is the last whose orderInList property was assigned
    //for (const place of this.places) {
    //  if (typeof place === 'object' && place.orderInList >= lastOrdered.orderInList && place.id !== lastOrdered.id) {}
    //}
    //for (let ind = 0, len = this.places.length; ind < len; ind++) {}
    let lastOrderInList = lastOrdered.orderInList;
    while (lastOrderInList <= this.maxTopOrder) {
      const sameOrderPlaces = this.unfilteredPlaces.filter((item) => {
        return item.id !== lastOrdered.id && item.orderInList === lastOrderInList;
      });
      if (sameOrderPlaces.length) {
        for (const place of sameOrderPlaces) {
          place.orderInList++;
          lastOrderInList = place.orderInList;
          // console.log('[DEBUG] VicinityComponent - checkListOrderNumber() - rétrogradation dans la liste', lastOrderInList);
        }
      } else {
        lastOrderInList = placeDefaultOrder; // the end
      }
    }
  }

  findPlaceListIndexById(baseListPlaces: Place[], wantedPlaceId): number {
    return baseListPlaces.findIndex((item) => {
      return item.id && item.id === wantedPlaceId;
    });
  }

  openSpecificSearch() {
    let specModalOptions = { ...this.modalOptions };
    specModalOptions.size = 'lg';
    specModalOptions.windowClass = 'modal-xxl';
    specModalOptions.scrollable = true;

    this.searchModalOpenRef = this.modalService.open(this.modalSpecificSearch, specModalOptions);
    this.searchModalOpenRef.result.then((result) => {
      // console.log('[MODAL]  then() ', result);
    }, (reason) => {
      // dismiss
      this.searchModalOpenRef = null;
    });
  }

  keepLastSearch(lastSearchCategogy: string): void {
    this.lastSearchCriteria = lastSearchCategogy;
    this.browserService.setLocalStorageSerializable(this.getKeySearch(), {code: this.lastSearchCriteria});
  }

  findPlaceToUpdate(existingPlace: Place) {
    // console.log('[DEBUG] findPlaceToUpdate() ', existingPlace);
    const isFiltered = (this.places.length < this.unfilteredPlaces.length);
    const placeFoundIndex = this.findPlaceListIndexById(this.places, existingPlace.id);
    if (placeFoundIndex !== -1) {
      // place retrouvée dans la liste filtrée (this.places[placeFoundIndex])
      // déterminer sur quelle page elle est affichée, pour pouvoir la sélectionner
      const numPage = this.whichPageNumberContainsTheIndex(this.places, placeFoundIndex);
      if (numPage > 0 && numPage <= this.totalPagesNumberFromList(this.places)) {
        if (numPage !== this.pageActive) {
          // se positionner sur cette page
          this.pageActive = numPage;
          this.changeSelectedItemNewPageActive(false);
        }
        const placeIndexActivePage = this.findPlaceListIndexById(this.activePagePlaces, existingPlace.id);
        of(keyWaitForDomAvailable).pipe(delay(60)).subscribe(value => {
          if (placeIndexActivePage !== -1) {
            // console.log('[DEBUG] findPlaceToUpdate() - numPage, placeIndexActivePage ', numPage, placeIndexActivePage);
            // place retrouvée dans la page active
            this.selectListItem(placeIndexActivePage);
            this.updatePlace();
          }
        });
      }
    } else {
      if (isFiltered) {
        const placeFoundIndex = this.findPlaceListIndexById(this.unfilteredPlaces, existingPlace.id);
        if (placeFoundIndex !== -1) {
          // place retrouvée dans la liste non filtrée (this.unfilteredPlaces[placeFoundIndex])
          // inutile d'assigner this.selectedPlaceId = existingPlace.id
          this.placeToForm = cloneDeep(this.unfilteredPlaces[placeFoundIndex]); // object deep copy (with lodash's method)
          this.doShowForm();
        }
      }
    }
    if (this.searchModalOpenRef) {
      this.searchModalOpenRef.close('close');
    }
  }

  addAnotherPlace(newPlace: Place) {
    // ajout d'une Place à partir d'une recherche spécifique
    newPlace.id = tempIdPrefix + this.unfilteredPlaces.length;
    newPlace.orderInList = this.maxTopOrder;
    newPlace.resultType = keyFromSpecificSearch;

    if (!newPlace.distance) {
      const newPlaceCoords = { latitude: newPlace.positionLat, longitude: newPlace.positionLng };
      // calculer la distance entre this.coordsAddress et newPlaceCoords
      newPlace.distance = this.mapService.getDistanceBetweenTwoPoints(this.coordsAddress, newPlaceCoords);
    }

    this.placeToForm = newPlace;
    if (this.searchModalOpenRef) {
      this.searchModalOpenRef.close('close');
    }
    this.doShowForm();
  }

}
