import { Injectable } from '@angular/core';
import { ApiHttpService } from './api.http.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Place } from 'src/app/model/place';
import { Address } from 'src/app/model/address';
import { environment } from 'src/environments/environment';
import { AppConfigService } from 'src/app/app.config.service';

export const keySuggestedAddressProperties = 'properties';
const keyLabelAddressProperty = 'address_line1';
const keyComplementAddressProperty = 'address_line2';
const keyCityAddressProperty = 'city';
const keyPostcodeAddressProperty = 'postcode';
const keyCountryAddressProperty = 'country';
const keyCountryCodeAddressProperty = 'country_code';
const keyCountyAddressProperty = 'county';
const keyAdministrativeAddressProperty = 'state';
const keyLatitudeAddressProperty = 'lat';
const keyLongitudeAddressProperty = 'lon';
const keyFormattedAddressProperty = 'formatted';
const keyDistrictAddressProperty = 'district';
const keyNameAddressProperty = 'name';
const keyStreetAddressProperty = 'street';
const keyHousenumberAddressProperty = 'housenumber';

@Injectable({
    providedIn: 'root'
})
export class LocationService {

  currentCoords: any;

  constructor(
    private configService: AppConfigService,
    private apiHttpService: ApiHttpService) {}

  public stripHtmlTags(str: string): string {
    return str.replace( /(<([^>]+)>)/ig, '');
  }

  setCurrentCoords(newCoords: any): void {
    const previousCoords = (typeof this.currentCoords === 'undefined') ? {} : this.currentCoords;
    const relocation = (JSON.stringify(newCoords).toLowerCase() !== JSON.stringify(previousCoords).toLowerCase());
    this.currentCoords = newCoords;

    if (relocation) {
      this.getInterestingClosePlaces();
    }
  }

  getCurrentCoords(): any {
    return this.currentCoords;
  }

  keepSimpleCoordsJsonObject(geolocationCoordinates: any): any {
    return {latitude: geolocationCoordinates.latitude, longitude: geolocationCoordinates.longitude};
  }

  getStandardAddressLabelFromPlaceSelection(selectedPlace: any): string {
    const namedPlace = this.isNamedSuggestion(selectedPlace);

    if (!namedPlace && selectedPlace.hasOwnProperty(keyFormattedAddressProperty) 
      && typeof selectedPlace[keyFormattedAddressProperty] === 'string'
      && selectedPlace[keyFormattedAddressProperty].trim() !== '') {
      return selectedPlace[keyFormattedAddressProperty];
    }

    if (!namedPlace && selectedPlace.hasOwnProperty(keyLabelAddressProperty) && typeof selectedPlace[keyLabelAddressProperty] === 'string'
      && selectedPlace.hasOwnProperty(keyComplementAddressProperty) && typeof selectedPlace[keyComplementAddressProperty] === 'string') {
      return selectedPlace[keyLabelAddressProperty] + ', ' + selectedPlace[keyComplementAddressProperty];
    }

    let convertedAddress = new Address(null, '', '', '', '', '');
    this.addressMappingFromSuggestion(convertedAddress, selectedPlace, false);

    return this.getStandardAddressLabelFromAddressObject(convertedAddress);
  }

  getCoordinatesFromPlaceSelection(selectedPlace: any, extended: boolean = false): any {
    let coordinates = null;
    let convertedAddress = new Address(null, '', '', '', '', '');
    this.addressMappingFromSuggestion(convertedAddress, selectedPlace);
    if (convertedAddress.latitude && convertedAddress.longitude) {
      coordinates = extended ? convertedAddress : { latitude: convertedAddress.latitude, longitude: convertedAddress.longitude };
    }

    return coordinates;
  }

  getStandardAddressLabelFromAddressObject(givenAddress: Address): string {
    let stdAddressLabel = givenAddress.addressLabel.trim();
    // ajouter le code postal si renseigné
    if (typeof givenAddress.postCode === 'string' && givenAddress.postCode.trim() !== '') {
      stdAddressLabel += ', ' + givenAddress.postCode.trim();
    }
    // ajouter la ville si renseignée
    if (typeof givenAddress.city === 'string' && givenAddress.city.trim() !== '') {
      stdAddressLabel += ' ' + givenAddress.city.trim();
    }
    // ajouter le pays si renseigné
    if (typeof givenAddress.country === 'string' && givenAddress.country.trim() !== '') {
      stdAddressLabel += ', ' + givenAddress.country.trim();
    }
    // unused: givenAddress.county and givenAddress.administrative
    return stdAddressLabel;
  }

  getStandardAddressVariationFromPlaceSelection(selectedPlace: any): string {
    let convertedAddress = new Address(null, '', '', '', '', '');
    this.addressMappingFromSuggestion(convertedAddress, selectedPlace, true);

    return this.getStandardAddressLabelFromAddressObject(convertedAddress);
  }

  firstHeerAccessControl(): boolean {
    const hasHeerToken = (this.apiHttpService.getHeerToken() !== null);

    if (!hasHeerToken) {
      // send request to get the first access token
      this.apiHttpService.getBackHeerAccessToken()
      .subscribe(jsonResponse => {
      });
    }

    return hasHeerToken;
  }

  getInterestingClosePlaces(): Observable<Place[]> {
    if (this.currentCoords && this.currentCoords.latitude && this.currentCoords.longitude) {
      // get the places of interest around user current location
      const latitude = this.currentCoords.latitude;
      const longitude = this.currentCoords.longitude;
      const radius = this.configService.config.heerApiRadius; // search radius, configured in meters
      const limit = this.configService.config.heerApiLimit; // maximum number of results to be returned
      const urlApiGet = `${environment.apiHeerUrl}${environment.heerApiSpecs}:${latitude},${longitude};r=${radius}&limit=${limit}`;
      this.apiHttpService.emptyArrayUnique();

      return this.apiHttpService.getOutsidePlaces(urlApiGet)
      .pipe(
        map( // pour filtrer le résultat
          (places: Place[]) => places.filter(
            (place: Place) => place.resultType === 'place' && this.apiHttpService.duplicateFilter(place.address) && place.categories.length
            // categories[] contient au moins un élément commençant par '100-' ou '550-' ou '600-' ou '700-'
            && place.categories.findIndex(
              categ => categ.startsWith('100-') || categ.startsWith('550-') || categ.startsWith('600-') || categ.startsWith('700-')
            ) !== -1
          )
        )
      );
    }
  }

  getClosePlacesFromCoords(centralCoords: any): Observable<Place[]> {
    return this.apiHttpService.getClosePlacesFromCoords(centralCoords);
  }

  isNamedSuggestion(theSuggestion: any): boolean {
    return theSuggestion.hasOwnProperty(keyNameAddressProperty) && theSuggestion.hasOwnProperty(keyStreetAddressProperty)
      && theSuggestion[keyNameAddressProperty] === theSuggestion[keyLabelAddressProperty] 
      && theSuggestion[keyStreetAddressProperty].trim() !== '';
  }

  /**
   * Hydrate une Address à partir d'un item retourné par l'API geoapify.com/address-autocomplete
   */
  addressMappingFromSuggestion(address: Address, selectedSuggestion: any, districtUse: boolean = false): void {
    if (selectedSuggestion.hasOwnProperty(keyLabelAddressProperty) && selectedSuggestion[keyLabelAddressProperty]) {
      if (this.isNamedSuggestion(selectedSuggestion)) {
        address.addressLabel = '';
        if (selectedSuggestion.hasOwnProperty(keyHousenumberAddressProperty) &&
          typeof selectedSuggestion[keyHousenumberAddressProperty] === 'string' &&
          selectedSuggestion[keyHousenumberAddressProperty].trim() !== '') {
          address.addressLabel = selectedSuggestion[keyHousenumberAddressProperty].trim() + ' ';
        }
        address.addressLabel += selectedSuggestion[keyStreetAddressProperty];
      } else {
        address.addressLabel = selectedSuggestion[keyLabelAddressProperty];
      }
    }
    const cityPropertyName = districtUse ? keyDistrictAddressProperty : keyCityAddressProperty;
    if (selectedSuggestion.hasOwnProperty(cityPropertyName) && selectedSuggestion[cityPropertyName]) {
      address.city = selectedSuggestion[cityPropertyName];
    } else {
      address.city = '';
    }
    if (selectedSuggestion.hasOwnProperty(keyPostcodeAddressProperty) && selectedSuggestion[keyPostcodeAddressProperty]) {
      address.postCode = selectedSuggestion[keyPostcodeAddressProperty];
    } else {
      address.postCode = '';
    }
    if (selectedSuggestion.hasOwnProperty(keyCountryAddressProperty) && selectedSuggestion[keyCountryAddressProperty]) {
      address.country = selectedSuggestion[keyCountryAddressProperty];
    }
    if (selectedSuggestion.hasOwnProperty(keyCountyAddressProperty) && selectedSuggestion[keyCountyAddressProperty]) {
      address.county = selectedSuggestion[keyCountyAddressProperty];
    }
    if (selectedSuggestion.hasOwnProperty(keyAdministrativeAddressProperty) && selectedSuggestion[keyAdministrativeAddressProperty]) {
      address.administrative = selectedSuggestion[keyAdministrativeAddressProperty];
    }
    if (selectedSuggestion.hasOwnProperty(keyLatitudeAddressProperty) && selectedSuggestion[keyLatitudeAddressProperty]) {
      address.latitude = '' + selectedSuggestion[keyLatitudeAddressProperty];
    } else {
      address.latitude = null;
    }
    if (selectedSuggestion.hasOwnProperty(keyLongitudeAddressProperty) && selectedSuggestion[keyLongitudeAddressProperty]) {
      address.longitude = '' + selectedSuggestion[keyLongitudeAddressProperty];
    } else {
      address.longitude = null;
    }
    if (selectedSuggestion.hasOwnProperty(keyCountryCodeAddressProperty) && selectedSuggestion[keyCountryCodeAddressProperty]) {
      address.countryCode = selectedSuggestion[keyCountryCodeAddressProperty];
    }
  }
}
