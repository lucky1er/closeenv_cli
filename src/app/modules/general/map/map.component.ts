import { Component, OnInit, Input, OnDestroy, ViewChild } from '@angular/core';
import { registerLocaleData, formatDate } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { TranslateService } from '@ngx-translate/core';
import { NgbModal, NgbModalOptions, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { MapComponentService } from './map.component.service';
import { AddOnTranslationService, appLocaleCodes } from '../service/addOn.translation.service';
import { BrowserService } from '../service/browser.service';
import { ApiHttpService } from '../service/api.http.service';
import { Place } from '../../../model/place';
import * as extraNews from 'src/assets/infos/extra-news.json';
import previewCategories from 'src/assets/params/json/preview-categories.json';

registerLocaleData(localeFr, appLocaleCodes.fr); // the second parameter 'fr-FR' is optional

const keyLevelOne = 'default';
const keyLabelEnglish = 'label-en';

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css'],
})
export class MapComponent implements OnInit, OnDestroy {

  @Input() readyForMap: boolean;
  @ViewChild('modalPreviewSearch') modalPreviewSearch: any;

  locale: string;
  newsMessage: string;
  homeMessages: any[];
  searchPending = false;
  shopCategories: any[];
  targetShopCategory: string;
  modalOptions: NgbModalOptions;
  searchModalOpenRef: NgbModalRef;
  searchResultPlaces: Place[];

  constructor(
    private modalService: NgbModal,
    public addonTranslator: AddOnTranslationService,
    private browserService: BrowserService,
    private apiHttpService: ApiHttpService,
    private translateService: TranslateService,
    public mapService: MapComponentService,
  ) {
    this.newsMessage = null;
    this.homeMessages = null;
    this.searchResultPlaces = null;
    this.targetShopCategory = '0';
  }

  ngOnInit(): void {
    const llabel = 'label-' + this.translateService.getDefaultLang();
    this.newsMessage = '';
    this.homeMessages = [];
    if (this.readyForMap) {
      this.shopCategories = previewCategories.map(item => {
        if (item[llabel]) {
          return { code: item.code, label: item[llabel] };
        } else {
          return { code: item.code, label: this.translateService.instant('Categ.' + item.code) };
        }
      });
    } else {
      this.locale = this.addonTranslator.getDeterminedLocale();
      // Appel API get home messages
      this.apiHttpService.getHomeMessages()
        .subscribe((messages) => {
          this.homeMessages = messages;
        }, (error) => {
          // console.warn('[API] getHomeMessages() returns error ', error);
        });

      this.addExtraNews();
    }
  }

  addExtraNews() {
    const keyMessage = 'message-' + this.translateService.getDefaultLang();
    for (const key in extraNews) {
      if (key === keyLevelOne && extraNews[key].hasOwnProperty(keyMessage)) {
        const firstLine = extraNews[key][keyMessage][0];
        if (firstLine && typeof firstLine === 'string' 
          && firstLine.trim() !== '' && firstLine.length > 2) {
          for (const line of extraNews[key][keyMessage]) {
            this.newsMessage += line + '<br/>'; // '\n';
          }
        }
      }
    }
  }

  getApplicationPurposeTextHtml(): string {
    return this.translateService.instant('Home.welcome.application.purpose');
  }

  getWordCloudImageRelativePath(): string {
    return `./assets/params/images/word-cloud_${this.addonTranslator.getTranslationDefaultLang()}.png`;
  }

  openPreviewSearch() {
    let specModalOptions = { ...this.modalOptions };
    specModalOptions.size = 'lg';
    specModalOptions.windowClass = 'modal-xxl';
    specModalOptions.scrollable = true;

    this.searchModalOpenRef = this.modalService.open(this.modalPreviewSearch, specModalOptions);
    this.searchModalOpenRef.result.then((result) => {
    }, (reason) => {
      // dismiss
      this.searchModalOpenRef = null;
    });
  }

  nearbyShopSearch() {
    this.searchResultPlaces = null;
    this.searchPending = true;
    // lancer l'API de recherche pour la categorie sélectionnée
    const centralPoint = this.browserService.getLocalStorageItem('position');
    const categoryRef = previewCategories.find(el => el.code === this.targetShopCategory);
    /*---*/
    this.apiHttpService.getClosePlacesFromCoordsAndCategory(centralPoint, categoryRef[keyLabelEnglish])
      .subscribe((fromAwayPlaces: Place[]) => {
        this.searchResultPlaces = fromAwayPlaces;
        if (this.searchResultPlaces.length) {
          this.mapService.refreshWithMarkers(this.searchResultPlaces, true); // replaces markers on map
          if (this.searchModalOpenRef) {
            this.searchModalOpenRef.close('close');
          }
        }
      }, (error) => {
        // console.warn('[API] getClosePlacesFromCoordsAndCategory - 9 ', error);
      }, () => {
        this.searchPending = false;
      });
    /*---*/
  }

  ngOnDestroy(): void {
    this.mapService.destroyMapOptions();
  }
}
