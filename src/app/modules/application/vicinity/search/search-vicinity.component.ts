import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { Observable } from 'rxjs';
import { debounceTime, distinctUntilChanged, map, filter } from 'rxjs/operators';
import cloneDeep from 'lodash-es/cloneDeep';

import { ApiHttpService } from 'src/app/modules/general/service/api.http.service';
import { AddOnTranslationService, CodeLabel } from 'src/app/modules/general/service/addOn.translation.service';
import { Place, tempIdPrefix } from 'src/app/model/place';
import { Address } from 'src/app/model/address';
import { Category } from 'src/app/model/category';

const keyEnsureErrorDisplay = 'ensure-error-display';
const keyLabelEnglish = 'label-en';

@Component({
  selector: 'app-search-vicinity',
  templateUrl: './search-vicinity.component.html',
  styleUrls: ['./search-vicinity.component.css']
})
export class SearchVicinityComponent implements OnInit {

  @Input() baseCategories: Category[];
  @Input() lastSearchCategoryCode: string;
  @Input() startingPoint: Address;
  @Input() existingPlaces: Place[];
  @Output() validatedSearchCategogy = new EventEmitter<string>();
  @Output() closeSearchForUpdating = new EventEmitter<Place>();
  @Output() closeSearchForAdding = new EventEmitter<Place>();

  optionCategories: CodeLabel[] = null;
  targetCategory: CodeLabel;
  requesting = false;
  warningMessage = '';
  showWarningMessage = false;
  searchResultPlaces: Place[];

  constructor(
    private apiHttpService: ApiHttpService,
    private addonTranslator: AddOnTranslationService
    ) {
    this.searchResultPlaces = null;
  }

  ngOnInit(): void {
    if (this.baseCategories) {
      this.optionCategories = this.addonTranslator.mapCodeLabelWithDefaultTranslation(this.baseCategories);
    }

    // console.log('[DEBUG] ngOnInit - lastSearchCategoryCode ', this.lastSearchCategoryCode);
    if (typeof this.lastSearchCategoryCode === 'string' && this.lastSearchCategoryCode.trim() !== '') {
      const categoryOpt = this.optionCategories.find(el => el.code === this.lastSearchCategoryCode);
      if (categoryOpt && categoryOpt.hasOwnProperty('label')) {
        this.targetCategory = categoryOpt;
      }
    }
  }

  formatter = (cat: Category) => cat.label;

  searchForCateg = (text$: Observable<string>) => text$.pipe(
    debounceTime(200),
    distinctUntilChanged(),
    filter(term => term.length >= 2),
    map(term => this.optionCategories.filter(cat => new RegExp(term, 'mi').test(cat.label)).slice(0, 10))
  )

  categoryTargeted(): boolean {
    return (this.targetCategory && this.targetCategory.code && this.targetCategory.code.trim() !== '');
  }

  searchPlaces() {
    // console.log('[DEBUG] Catégorie ciblée ', this.targetCategory);
    if (this.categoryTargeted()) {
      this.validatedSearchCategogy.emit(this.targetCategory.code);

      this.searchResultPlaces = [];
      this.requesting = true;

      // chercher d'abord dans les places existantes
      const filteredExistingPlaces = this.existingPlaces.filter((place: Place) => {
        if (place.categories.length) {
          return (place.categories.findIndex(categ => categ === this.targetCategory.code) !== -1);
        } else {
          return false;
        }
      });
      if (filteredExistingPlaces.length) {
        // console.log('[DEBUG] searchPlaces() - Existing... ', filteredExistingPlaces);
        this.integrateSelection(filteredExistingPlaces);
      }

      // chercher encore via l'API base getPotentialPlaces()
      this.apiHttpService.getPotentialPlaces(this.startingPoint.id, true)
        .subscribe(([respFromBase, respOutOfContext]) => {
          if (respFromBase.length) {
            const filteredMoreFromBasePlaces = respFromBase.filter((place: Place) => {
              if (place.categories.length) {
                return (place.categories.findIndex(categ => categ === this.targetCategory.code) !== -1);
              } else {
                return false;
              }
            });
            if (filteredMoreFromBasePlaces.length) {
              // console.log('[DEBUG] searchPlaces() - More from Base... ', filteredMoreFromBasePlaces);
              this.integrateSelection(filteredMoreFromBasePlaces);
            }
          }
        });

      const categoryRef: Category = this.baseCategories.find(el => el.code === this.targetCategory.code);

      if (categoryRef) {
        // chercher enfin via l'API externe
        this.apiHttpService.getClosePlacesFromCoordsAndCategory(this.startingPoint, categoryRef.label.en)
          .subscribe((fromAwayPlaces: Place[]) => {
            // console.log('[DEBUG] fromAwayPlaces ', fromAwayPlaces);
            if (fromAwayPlaces.length) {
              this.integrateSelection(fromAwayPlaces);
            }
            this.requesting = false;
          }, (error) => {
            // console.warn('[API] SearchVicinityComponent, searchPlaces - 9 ', error);
            this.requesting = false;
          });
      } else {
        this.requesting = false;
      }
    }
  }

  integrateSelection(selectionPlaces: Place[]) {
    for (const aPlace of selectionPlaces) {
      const placeIndex = this.searchResultPlaces.findIndex((item) => { // ici this.searchResultPlaces is null
        return item.title && (Place.normalizedStringsEquality(item.title, aPlace.title)
          || item.address === aPlace.address);
      });
      if (placeIndex === -1) {
        if (!aPlace.flags) {
          aPlace.flags = [];
        }
        this.searchResultPlaces.push(cloneDeep(aPlace));
      }
    }
  }

  getTooltipTextContacts(place: Place): string {
    let listContacts = '';
    if (place.contacts && place.contacts.length) {
      for (const contact of place.contacts) {
        listContacts += (listContacts === '' ? '' : ', ') + contact;
      }
    }
    return listContacts;
  }

  getKilometDistance(place: Place): string {
    const kmDist = place.distance / 1000;
    return kmDist.toFixed(3) + ' km';
  }

  isPlaceFromExistingOld(place: Place): boolean {
    const placeId = parseInt(place.id, 10);
    let idUnknown = (isNaN(placeId) || placeId === 0);
    return !idUnknown || place.id.startsWith(tempIdPrefix);
  }

  isPlaceFromExisting(place: Place): boolean {
    const placeExisting = this.existingPlaces.find(el => el.id === place.id);
    return (placeExisting && placeExisting.hasOwnProperty('title'));
  }

  backListForUpdating(place: Place): void {
    if (this.isPlaceFromExisting(place)) {
      // retour au parent pour éditer la place
      this.closeSearchForUpdating.emit(place);
    }
  }

  backListForAdding(place: Place): void {
    if (!this.isPlaceFromExisting(place)) {
      // retour au parent pour ajouter la place
      this.closeSearchForAdding.emit(place);
    }
  }

}
