import { Component, OnInit, AfterViewInit, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { BrowserService } from '../service/browser.service';
import { LocationService, keySuggestedAddressProperties } from '../service/location.service';
import { AddOnTranslationService } from '../service/addOn.translation.service';
import { MapComponentService } from '../map/map.component.service';
import { Place } from '../../../model/place';

@Component({
  selector: 'app-relocate',
  templateUrl: './relocate.component.html',
  styleUrls: ['./relocate.component.css']
})
export class RelocateComponent implements OnInit, AfterViewInit {

  selectedCoordinates = null;
  closePlaces: Place[];
  warningMessage = '';
  warningMessageStrong = '';
  showWarningMessage = false;
  geolocationError = false;
  searchLocation: any = {
    type: 'amenity',
    skipIcons: true,
    skipDetails: true,
    biasByCountryCode: null
  };

  constructor(
    public addonTranslator: AddOnTranslationService,
    private router: Router,
    private browserService: BrowserService,
    private locationService: LocationService,
    private mapComponentService: MapComponentService,
    @Inject(PLATFORM_ID) private  platformId: object) {
    if (!isPlatformBrowser(platformId)) {
      console.log('[SSR] RelocateComponent, not Browser ', platformId);
    }
  }

  ngOnInit(): void {
    this.addonTranslator.checkMetaTagInit();
    this.addonTranslator.checkRouteParamLang();
  }

  ngAfterViewInit() {
    if (this.browserService.isLocalStorageSupported()) {
      // vérifier si on connait une localisation pour la map
      const userCoords = this.browserService.getLocalStorageItem('position');
      if (userCoords !== null) {
        // supprimer la clé LS de localisation pour la map
        this.browserService.removeLocalStorageItem('position');
      }
    }
  }

  checkCurrentLocation(): void {
    // call subscribe() to start listening observable in browserService (asynchronous request)
    const testPosition = this.browserService.geoLocateObs.subscribe({
      next: positionFound => {
        // il faut un objet sérialisable pour passer dans le LocalStorage
        const simpleCoords = this.locationService.keepSimpleCoordsJsonObject(positionFound.coords);
        this.considerNewCoords(simpleCoords);
      },
      complete: () => {
        this.router.navigate(['/']); // go home
      },
      error: errorMessage => {
        console.warn('[debug] checkCurrentLocation => error ', errorMessage);
        this.warningMessage = errorMessage;
        this.showWarningMessage = true;
        this.geolocationError = true;
      }
    });
  }

  selectAddressCoords(selectedAddress: any): void {
    if (selectedAddress.hasOwnProperty(keySuggestedAddressProperties) && selectedAddress[keySuggestedAddressProperties]
      && typeof selectedAddress[keySuggestedAddressProperties] === 'object') {
      this.selectedCoordinates = this.locationService.getCoordinatesFromPlaceSelection(selectedAddress[keySuggestedAddressProperties], true);
    }
  }

  validateSelectedCoords(): void {
    this.considerNewCoords(this.selectedCoordinates);
    this.router.navigate(['/']); // go home
  }

  considerNewCoords(newCoords: any): void {
    this.locationService.setCurrentCoords(newCoords);
    this.mapComponentService.resetMapOptions(newCoords, []);
    this.browserService.setLocalStorageItem('position', newCoords); // sauvegarde en LocalStorage
  }
}
