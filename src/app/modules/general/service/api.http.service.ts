import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, of, from, forkJoin } from 'rxjs';
import { map, tap, delay, catchError } from 'rxjs/operators';
import { BrowserService } from './browser.service';
import { AppConfigService } from 'src/app/app.config.service';
import { environment } from '../../../../environments/environment';
import { Place } from '../../../model/place';
import { Subscription } from '../../../model/subscription';
import { Address } from '../../../model/address';
import { User } from 'src/app/model/user';
import { ShopMessage } from 'src/app/model/shopMessage';
import { LookingFor } from 'src/app/model/lookingFor';
import { Answer } from 'src/app/model/answer';
import { Category } from 'src/app/model/category';

const httpOptions = {
  headers: new HttpHeaders({
    'Content-Type': 'application/json',
  })
};
const httpPatchOptions = {
  headers: new HttpHeaders({
    //'Content-Type': 'application/vnd.api+json',
    'Content-Type': 'application/merge-patch+json'
  })
}
const httpOptionsBlob = {
  responseType: 'blob' as 'json',
  headers: new HttpHeaders({
    'Content-Type': 'application/json'
  })
};

const keyItems = 'items';
const keyHeerToken = 'jet_on_heer';
const userApiGen = '/api/users/';
export const keyBaseUser = 'logged';

@Injectable({
  providedIn: 'root'
})
export class ApiHttpService {

  private connectivity = true;
  private arrayUnique: string[];

  constructor(
    private http: HttpClient,
    private configService: AppConfigService,
    private browserService: BrowserService
    ) {
  }

  isOffline(): boolean {
    // flag devant servir à désactiver les fonctions requiérant une connectivité réseau
    return !this.connectivity;
  }

  getIriRootFromUserIri(userIri: string): string {
    return userIri.substring(0, userIri.indexOf(userApiGen));
  }

  getIdFromIri(iriString: string): string {
    let idFromString = '0';
    if (iriString && typeof iriString === 'string' && iriString.trim() !== '') {
      // iriString contient un IRI (genre '/edsa-api-closeenv/api/places/494')
      const lastIndexBeforeId = iriString.lastIndexOf('/');
      idFromString = iriString.substring(lastIndexBeforeId + 1);
    }
    return idFromString;
  }

  public duplicateFilter(controlIndex: string): boolean {
    let newIndex = false;
    if (this.arrayUnique.indexOf(controlIndex) === -1) {
      newIndex = true;
      this.arrayUnique.push(controlIndex);
    }
    return newIndex;
  }

  public emptyArrayUnique(): void {
    this.arrayUnique = [];
  }

  getApi(url: string): Observable<any> {
    return this.http.get(url, httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  connectivityChecking(): Observable<boolean> {
    const api = `${environment.apiBaseUrl}/app/netw`;
    return this.http.get(api, httpOptions)
      .pipe(
        map(status => {
          this.connectivity = true; // connectivity OK
          return this.connectivity;
        }),
        catchError(error => {
          this.connectivity = (error.status !== 0 && error.status !== 503 && error.status !== 504);
          return of(this.connectivity);
        })
      );
  }

  public getOutsidePlaces(url: string, attemptNumber: number = 1): Observable<Place[]> {
    return this.http.get(url, httpOptions)
    .pipe(
      // on ne s'intéresse qu'à ce qui se trouve dans la propriété 'items' du résultat json
      map(result => result[keyItems]),
      // les erreurs éventuelles sont traitées par ApiHttpInterceptor
    )
    .pipe(
      // on fait le mapping de chaque item pour instancier une Place
      map((jsonArray: object[]) => jsonArray.map(jsonItem => Place.fromJson(jsonItem))),
    );
  }

  postApi(url: string, body: any): Observable<any> {
    return this.http.post(url, body, httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  getClosePlacesFromCoords(centralCoords: any, specRadius: number = 0): Observable<Place[]> {
    if (centralCoords && centralCoords.latitude && centralCoords.longitude) {
      // get the places around this central location
      const latitude = centralCoords.latitude;
      const longitude = centralCoords.longitude;
      const radius = specRadius ? specRadius : this.configService.config.heerApiRadius; // search radius, configured in meters
      const limit = this.configService.config.heerApiLimit; // maximum number of results to be returned
      const urlApiGet = `${environment.apiHeerUrl}${environment.heerApiSpecs}:${latitude},${longitude};r=${radius}&limit=${limit}`;
      this.emptyArrayUnique();

      return this.getOutsidePlaces(urlApiGet)
      .pipe(
        map( // pour filtrer le résultat
          (places: Place[]) => places.filter(
            (place: Place) => place.resultType === 'place' && this.duplicateFilter(place.address) && place.categories.length &&
            // categories[] contient au moins un élément commençant par '100-' ou '550-' ou '600-' ou '700-'
            place.categories.findIndex(
              categ => categ.startsWith('100-') || categ.startsWith('550-') || categ.startsWith('600-') || categ.startsWith('700-')
            ) !== -1
          )
        )
      );
    }
  }

  getClosePlacesFromCoordsAndCategory(centralCoords: any, category: string): Observable<Place[]> {
    // pour cette méthode, on a pris modèle sur getClosePlacesFromCoords() ci-dessus, en ajoutant le code Catégorie ciblée dans l'url
    const latitude = centralCoords.latitude;
    const longitude = centralCoords.longitude;
    const radius = this.configService.config.heerApiRadius + this.configService.config.toleranceMargin;
    const limit = this.configService.config.heerApiLimit; // maximum number of results to be returned
    const firstPart = `${environment.apiHeerUrl}${environment.heerApiCategSpec}`;
    const urlApiGet = `${firstPart}:${latitude},${longitude};r=${radius}&q=${category}&limit=${limit}`;

    return this.getOutsidePlaces(urlApiGet)
      .pipe(
        map( // pour filtrer le résultat
          (places: Place[]) => places.filter(
            (place: Place) => place.resultType === 'place'
          )
        )
      );
  }

  getBackHeerAccessToken(): Observable<any> {
    return this.http.get(environment.urlHeerAccessToken, httpOptions)
      .pipe(
        /*  le retour json (en cas de succès) doit se présenter comme suit :
            {
              "access_token":"VE5URXlJbjAuLmE876l4eVpQVE1zbHRwcnQyZ1BSVGcuS3RHT2V...",
              "token_type":"bearer",
              "expires_in":86399
            }
        */
        tap(jsonResponse => {
          this.setHeerToken(jsonResponse.access_token); // store renewed token
        }),
      );
  }


  checkMaintenance(): Observable<boolean> {
    const api = `${environment.apiBaseUrl}/app/status_check`;
    return this.http.get(api, httpOptions)
      .pipe(
        // le resultat json est retourné sans mapping
        map((jsonResp: boolean) => jsonResp),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  getContextApp(): Observable<any[]> {
    const api = `${environment.apiBaseUrl}/api/general_app`;
    return this.http.get(api, httpOptions)
      .pipe(
        // le resultat json est retourné sans mapping
        map((jsonArray: object[]) => jsonArray),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  toggleMaintenance(): Observable<boolean> {
    const api = `${environment.apiBaseUrl}/api/maint/status_toggle`;
    return this.http.put(api, {}, httpOptions)
      .pipe(
        // le resultat json est retourné sans mapping
        map((jsonResp: boolean) => jsonResp),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  getStatsCounters(): Observable<any[]> {
    const api = `${environment.apiBaseUrl}/api/stats/counters_get`;
    return this.http.get(api, httpOptions)
      .pipe(
        // le resultat json est retourné sans mapping
        map((jsonArray: object[]) => jsonArray),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  getCountriesForUsersReport(): Observable<any[]> {
    const api = `${environment.apiBaseUrl}/api/report/users/countries/list`;
    return this.http.get(api, httpOptions)
      .pipe(
        // le resultat json est retourné sans mapping
        map((jsonArray: object[]) => jsonArray),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  getReportUsers(countryCode): Observable<any[]> {
    const api = `${environment.apiBaseUrl}/api/report/users/${countryCode}/count`;
    return this.http.get(api, httpOptions)
      .pipe(
        // le resultat json est retourné sans mapping
        map((jsonArray: object[]) => jsonArray),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  getReportInvoicing(year): Observable<any[]> {
    const api = `${environment.apiBaseUrl}/api/report/invoicing/${year}/get`;
    return this.http.get(api, httpOptions)
      .pipe(
        // le resultat json est retourné sans mapping
        map((jsonArray: object[]) => jsonArray),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  getReportInvoicingDetail(period): Observable<any[]> {
    const api = `${environment.apiBaseUrl}/api/report/invoicing/detail/${period}`;
    return this.http.get(api, httpOptions)
      .pipe(
        // le resultat json est retourné sans mapping
        map((jsonArray: object[]) => jsonArray),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  getInvoicingPeriodArchivingRequest(period): Observable<any[]> {
    const api = `${environment.apiBaseUrl}/api/report/invoicing/arch/${period}/req`;
    return this.http.get(api, httpOptions)
      .pipe(
        // le resultat json est retourné sans mapping
        map((jsonArray: object[]) => jsonArray),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  getHomeMessages(): Observable<any[]> {
    const api = `${environment.apiBaseUrl}/app/home_messages`;
    return this.http.get(api, httpOptions)
      .pipe(
        // le resultat json est retourné sans mapping
        map((jsonArray: object[]) => jsonArray),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  getPendingMessages(): Observable<any[]> {
    const api = `${environment.apiBaseUrl}/api/general_messages_pending`;
    return this.http.get(api, httpOptions)
      .pipe(
        // le resultat json est retourné sans mapping
        map((jsonArray: object[]) => jsonArray),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  getSubscription(idSubscrip: string): Observable<Subscription> {
    const api = `${environment.apiBaseUrl}/api/subscription_uses/${idSubscrip}`;
    return this.http.get(api, httpOptions)
      .pipe(
        // on fait le mapping du json pour instancier une Subscription
        map((json: object) => Subscription.fromJson(json)),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  postSubscriptionOrder(bodySubscription: any): Observable<Subscription> {
    const api = `${environment.apiBaseUrl}/api/subscription_uses_order`;
    return this.http.post(api, bodySubscription, httpOptions)
      .pipe(
        // on fait le mapping du json pour instancier une Subscription
        map((json: object) => Subscription.fromJson(json)),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  patchSubscriptionOrder(subscriptionId, subscriptionDataBody: any): Observable<Subscription> {
    const api = `${environment.apiBaseUrl}/api/subscription_uses/${subscriptionId}`;
    return this.http.patch(api, subscriptionDataBody, httpPatchOptions)
      .pipe(
        // on fait le mapping du json pour instancier une Subscription
        map((json: object) => Subscription.fromJson(json)),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }


  getUserData(apiSpec: string): Observable<any> {
    const api = `${environment.apiBaseUrl}${apiSpec}`;
    return this.http.get(api, httpOptions)
      .pipe(
        // no mapping
        map((jsonArray: object[]) => jsonArray),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  getAddress(idAddress): Observable<Address> {
    const api = `${environment.apiBaseUrl}/api/addresses/${idAddress}`;
    return this.http.get(api, httpOptions)
      .pipe(
        // on fait le mapping du json pour instancier une Address
        map((json: object) => Address.fromJson(json)),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  getUserAddresses(userId: string): Observable<Address[]> {
    const api = `${environment.apiBaseUrl}/api/addresses?ow=${userId}`;
    return this.http.get(api, httpOptions)
      .pipe(
        // on fait le mapping de chaque item pour instancier une Address
        map((jsonArray: object[]) => jsonArray.map(jsonItem => Address.fromJson(jsonItem))),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  postAddress(bodyAddress: Address): Observable<Address> {
    const api = `${environment.apiBaseUrl}/api/addresses`;
    return this.http.post(api, bodyAddress, httpOptions)
      .pipe(
        // on fait le mapping du json pour instancier une Address
        map((json: object) => Address.fromJson(json)),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  putAddress(bodyAddress: Address): Observable<Address> {
    const api = `${environment.apiBaseUrl}/api/addresses/${bodyAddress.id}`;
    return this.http.put(api, bodyAddress, httpOptions)
      .pipe(
        // on fait le mapping du json pour instancier une Address
        map((json: object) => Address.fromJson(json)),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  deleteAddress(bodyAddress: Address): Observable<any> {
    const api = `${environment.apiBaseUrl}/api/addresses/${bodyAddress.id}`;
    return this.http.delete(api, httpOptions)
      .pipe(
        // le resultat json est retourné sans mapping
        map((json: object) => json),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  postCity(bodyAddress: Address): Observable<any> {
    const api = `${environment.apiBaseUrl}/api/cities_custom`;
    return this.http.post(api, bodyAddress, httpOptions)
      .pipe(
        // le resultat json est retourné sans mapping
        map((jsonArray: object[]) => jsonArray),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  getLinkedPlaces(idAddress): Observable<Place[]> {
    const api = `${environment.apiBaseUrl}/api/address/${idAddress}/places_get`;
    return this.http.get(api, httpOptions)
      .pipe(
        // on fait le mapping de chaque item pour instancier une Place
        map((jsonArray: object[]) => jsonArray.map(jsonItem => Place.fromJsonBase(jsonItem))),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  postLinkedPlaces(idAddress, bodyPlaces: any): Observable<Place[]> {
    const api = `${environment.apiBaseUrl}/api/address/${idAddress}/places_post`;
    return this.http.post(api, bodyPlaces, httpOptions)
      .pipe(
        // on fait le mapping de chaque item pour instancier une Place
        map((jsonArray: object[]) => jsonArray.map(jsonItem => Place.fromJsonBase(jsonItem))),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  deleteLinkedPlaces(idAddress): Observable<any> {
    const api = `${environment.apiBaseUrl}/api/address/${idAddress}/places_delete`;
    return this.http.delete(api, httpOptions)
      .pipe(
        // le resultat json est retourné sans mapping
        map((jsonArray: object[]) => jsonArray),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  getPotentialPlaces(idAddress, extendedSearch: boolean, addressCoords: any = null): Observable<[Place[], Place[]]> {
    const paramExtendedSearch = extendedSearch ? '1' : '0';
    const api = `${environment.apiBaseUrl}/api/nearby/${idAddress}/places_get/${paramExtendedSearch}`;
    const fromBase = this.http.get(api, httpOptions)
      .pipe(
        // on fait le mapping de chaque item pour instancier une Place
        map((jsonArray: object[]) => jsonArray.map(jsonItem => Place.fromJsonBase(jsonItem))),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
    const fromAway = addressCoords ? this.getClosePlacesFromCoords(addressCoords) : of([]);

    return forkJoin([fromBase, fromAway]);
  }

  patchPlace(placeId, placeDataBody: any): Observable<Place> {
    const api = `${environment.apiBaseUrl}/api/places/${placeId}`;
    return this.http.patch(api, placeDataBody, httpPatchOptions)
      .pipe(
        // on fait le mapping du json pour instancier une Place
        map((json: object) => Place.fromJsonBase(json)),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  patchUser(userId, userDataBody: any): Observable<User> {
    const api = `${environment.apiBaseUrl}/api/users/${userId}`;
    return this.http.patch(api, userDataBody, httpPatchOptions)
      .pipe(
        // on fait le mapping du json pour instancier un User
        map((json: object) => User.populateFromJson(json)),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  partialPostUser(userId, userDataBody: any): Observable<User> {
    const api = `${environment.apiBaseUrl}/api/users/${userId}/update`;
    return this.http.post(api, userDataBody, httpOptions)
      .pipe(
        // on fait le mapping du json pour instancier un User
        map((json: object) => User.populateFromJson(json)),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  updateUser(userId, userDataBody: any): Observable<User> {
    if (this.configService.config.patchUser) {
      return this.patchUser(userId, userDataBody);
    } else {
      return this.partialPostUser(userId, userDataBody);
    }
  }

  getUserInvoices(year, locale): Observable<any[]> {
    const api = `${environment.apiBaseUrl}/api/invoice/list/${year}/${locale}`;
    return this.http.get(api, httpOptions)
      .pipe(
        // le resultat json est retourné sans mapping
        map((jsonArray: object[]) => jsonArray),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  postInvoiceDownload(sid, customBody: any): Observable<Blob> {
    const api = `${environment.apiBaseUrl}/api/invoice/download/${sid}`;
    return this.http.post<Blob>(api, customBody, httpOptionsBlob)
      .pipe(
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      )
      ;
  }

  getUsersCountAroundAddress(idAddress, extendedSearch: boolean): Observable<any[]> {
    const paramExtendedSearch = extendedSearch ? '1' : '0';
    const api = `${environment.apiBaseUrl}/api/nearby/${idAddress}/users_count/${paramExtendedSearch}`;
    return this.http.get(api, httpOptions)
      .pipe(
        // le resultat json est retourné sans mapping
        map((jsonArray: object[]) => jsonArray),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  getUsersDataAroundAddress(idAddress, extendedSearch: boolean): Observable<any[]> {
    const paramExtendedSearch = extendedSearch ? '1' : '0';
    const api = `${environment.apiBaseUrl}/api/nearby/${idAddress}/users_get/${paramExtendedSearch}`;
    return this.http.get(api, httpOptions)
      .pipe(
        // le resultat json est retourné sans mapping
        map((jsonArray: object[]) => jsonArray),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  getShopNumberMessages(idAddress: number, isAssociation: boolean): Observable<any> {
    const placeType = isAssociation ? 'asso' : 'shop';
    const api = `${environment.apiBaseUrl}/api/${placeType}/${idAddress}/messages_count`;
    return this.http.get(api, httpOptions)
      .pipe(
        // le resultat json est retourné sans mapping
        map((jsonArray: object[]) => jsonArray),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  getShopPlace(idAddress: number): Observable<Place> {
    //const api = `${environment.apiBaseUrl}${apiSpec}`;
    const api = `${environment.apiBaseUrl}/api/shop/${idAddress}/place_get`;
    return this.http.get(api, httpOptions)
      .pipe(
        // on fait le mapping du json pour instancier une Place
        map((json: object) => Place.fromJsonBase(json)),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  checkShopPlace(idAddress: number): Observable<any> {
    const api = `${environment.apiBaseUrl}/api/shop/${idAddress}/place_check`;
    return this.http.get(api, httpOptions)
      .pipe(
        // le resultat json est retourné sans mapping
        map((jsonArray: object[]) => jsonArray),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  cleanShopPlace(idAddress: number): Observable<any> {
    const api = `${environment.apiBaseUrl}/api/shop/${idAddress}/place_clean`;
    return this.http.get(api, httpOptions)
      .pipe(
        // le resultat json est retourné sans mapping
        map((jsonArray: object[]) => jsonArray),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  postShopPlace(bodyShop: Place): Observable<Place> {
    const api = `${environment.apiBaseUrl}/api/places`;
    return this.http.post(api, bodyShop, httpOptions)
      .pipe(
        // on fait le mapping du json pour instancier une Place
        map((json: object) => Place.fromJsonBase(json)),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  ownershipOpinion(): Observable<any> {
    const api = `${environment.apiBaseUrl}/api/shop/ownership/opinion`;
    return this.http.get(api, httpOptions)
      .pipe(
        // le resultat json est retourné sans mapping
        map((jsonArray: object[]) => jsonArray),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  ownershipDatas(tokenWrap: any): Observable<any> {
    const api = `${environment.apiBaseUrl}/api/shop/ownership/data`;
    return this.http.post(api, tokenWrap)
      .pipe(
        map((json: any) => {
          // mapping du json pour instancier un User et une Place
          return {
            user: User.populateFromJson(json.user),
            shop: Place.fromJsonBase(json.shop)
          };
        }),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  ownershipConfirm(tokenWrap: any): Observable<any> {
    const api = `${environment.apiBaseUrl}/api/shop/ownership/confirm`;
    return this.http.post(api, tokenWrap)
      .pipe(
        // le resultat json est retourné sans mapping
        map((json: object) => json),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  ownershipDeny(tokenWrap: any): Observable<any> {
    const api = `${environment.apiBaseUrl}/api/shop/ownership/deny`;
    return this.http.post(api, tokenWrap)
      .pipe(
        // le resultat json est retourné sans mapping
        map((json: object) => json),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  postSuggestedGuests(idAddress: number, place: Place, guests: string[]): Observable<any> {
    const api = `${environment.apiBaseUrl}/api/guest/${idAddress}/suggest`;
    const postBody = {
      place: { title: place.title, address: place.address },
      guests: guests
    };
    return this.http.post(api, postBody, httpOptions)
      .pipe(
        // le resultat json est retourné sans mapping
        map((json: object) => json),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  postMerchantInvitation(idPlace, userAddress: Address): Observable<any> {
    const api = `${environment.apiBaseUrl}/api/guest/${idPlace}/invite`;
    return this.http.post(api, {address: userAddress}, httpOptions)
      .pipe(
        // le resultat json est retourné sans mapping
        map((json: object) => json),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  getPlaceMessages(place: Place): Observable<ShopMessage[]> {
    const placeType = Place.isAssociation(place) ? 'asso' : 'shop';
    const api = `${environment.apiBaseUrl}/api/${placeType}/${place.id}/messages_get`;
    return this.http.get(api, httpOptions)
      .pipe(
        // on fait le mapping de chaque item pour instancier un ShopMessage
        map((jsonArray: object[]) => jsonArray.map(jsonItem => ShopMessage.fromJson(jsonItem))),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  viewShopMessage(idAddress, place: Place): Observable<any> {
    const placeType = Place.isAssociation(place) ? 'asso' : 'shop';
    const api = `${environment.apiBaseUrl}/api/${placeType}/${idAddress}/view/${place.id}/message`;
    return this.http.get(api, httpOptions)
      .pipe(
        // le resultat json est retourné sans mapping
        map((json: object) => json),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  postMessage(place: Place, bodyMessage: ShopMessage): Observable<ShopMessage> {
    const placeType = Place.isAssociation(place) ? 'asso' : 'shop';
    const api = `${environment.apiBaseUrl}/api/${placeType}_messages`;
    return this.http.post(api, bodyMessage, httpOptions)
      .pipe(
        // on fait le mapping du json pour instancier un ShopMessage
        map((json: object) => ShopMessage.fromJson(json)),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  putMessage(place: Place, bodyMessage: ShopMessage): Observable<ShopMessage> {
    const placeType = Place.isAssociation(place) ? 'asso' : 'shop';
    const api = `${environment.apiBaseUrl}/api/${placeType}_messages/${bodyMessage.id}`;
    return this.http.put(api, bodyMessage, httpOptions)
      .pipe(
        // on fait le mapping du json pour instancier un ShopMessage
        map((json: object) => ShopMessage.fromJson(json)),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  deleteMessage(place: Place, bodyMessage: ShopMessage): Observable<any> {
    const placeType = Place.isAssociation(place) ? 'asso' : 'shop';
    const api = `${environment.apiBaseUrl}/api/${placeType}_messages/${bodyMessage.id}`;
    return this.http.delete(api, httpOptions)
      .pipe(
        // le resultat json est retourné sans mapping
        map((json: object) => json),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  getShopMessageDeliveries(place: Place, idMessage): Observable<any[]> {
    const placeType = Place.isAssociation(place) ? 'asso' : 'shop';
    const api = `${environment.apiBaseUrl}/api/${placeType}/message/${idMessage}/deliveries_get`;
    return this.http.get(api, httpOptions)
      .pipe(
        // le resultat json est retourné sans mapping
        map((jsonArray: object[]) => jsonArray),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }


  getAddressLookingFors(address: Address): Observable<LookingFor[]> {
    const api = `${environment.apiBaseUrl}/api/looking/for/${address.id}/get_mine`;
    return this.http.get(api, httpOptions)
      .pipe(
        // on fait le mapping de chaque item pour instancier un LookingFor
        map((jsonArray: object[]) => jsonArray.map(jsonItem => LookingFor.fromJson(jsonItem))),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  getLookingForAnswers(lookingFor: LookingFor): Observable<Answer[]> {
    const api = `${environment.apiBaseUrl}/api/looking/${lookingFor.id}/get_answers`;
    return this.http.get(api, httpOptions)
      .pipe(
        // on fait le mapping de chaque item pour instancier un Answer
        map((jsonArray: object[]) => jsonArray.map(jsonItem => Answer.fromJson(jsonItem))),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  readLookingForAnswer(answerId): Observable<boolean> {
    const api = `${environment.apiBaseUrl}/api/looking/answer/${answerId}/read`;
    return this.http.put(api, {}, httpOptions)
      .pipe(
        // le resultat json est retourné sans mapping
        map((jsonResp: boolean) => jsonResp),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  getVicinityLookingFors(idAddress): Observable<LookingFor[]> {
    const api = `${environment.apiBaseUrl}/api/looking/for/${idAddress}/get_near`;
    return this.http.get(api, httpOptions)
      .pipe(
        // on fait le mapping de chaque item pour instancier un LookingFor
        map((jsonArray: object[]) => jsonArray.map(jsonItem => LookingFor.fromJson(jsonItem))),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  postLookingFor(bodyLookingFor: LookingFor): Observable<LookingFor> {
    const api = `${environment.apiBaseUrl}/api/looking_fors`;
    return this.http.post(api, bodyLookingFor, httpOptions)
      .pipe(
        // on fait le mapping du json pour instancier un LookingFor
        map((json: object) => LookingFor.fromJson(json)),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  putLookingFor(bodyLookingFor: LookingFor): Observable<LookingFor> {
    const api = `${environment.apiBaseUrl}/api/looking_fors/${bodyLookingFor.id}`;
    return this.http.put(api, bodyLookingFor, httpOptions)
      .pipe(
        // on fait le mapping du json pour instancier un LookingFor
        map((json: object) => LookingFor.fromJson(json)),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  deleteLookingFor(bodyLookingFor: LookingFor): Observable<any> {
    const api = `${environment.apiBaseUrl}/api/looking_fors/${bodyLookingFor.id}`;
    return this.http.delete(api, httpOptions)
      .pipe(
        // le resultat json est retourné sans mapping
        map((json: object) => json),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  toggleLookingForUnwanted(idLookingFor): Observable<boolean> {
    const api = `${environment.apiBaseUrl}/api/looking/user/message_status_toggle/${idLookingFor}`;
    return this.http.put(api, {}, httpOptions)
      .pipe(
        // le resultat json est retourné sans mapping
        map((jsonResp: boolean) => jsonResp),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  postAnswer(bodyAnswer: Answer): Observable<Answer> {
    const api = `${environment.apiBaseUrl}/api/answers`;
    return this.http.post(api, bodyAnswer, httpOptions)
      .pipe(
        // on fait le mapping du json pour instancier un Answer
        map((json: object) => Answer.fromJson(json)),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  deleteAnswer(bodyAnswer: Answer): Observable<any> {
    const api = `${environment.apiBaseUrl}/api/answers/${bodyAnswer.id}`;
    return this.http.delete(api, httpOptions)
      .pipe(
        // le resultat json est retourné sans mapping
        map((json: object) => json),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  /*
  postBaseCategories(bodyCategorie: Category): Observable<Category> {
    const api = `${environment.apiBaseUrl}/api/categories`;
    return this.http.post(api, bodyCategorie, httpOptions)
      .pipe(
        // on fait le mapping du json pour instancier une Category
        map((json: object) => Category.fromJson(json)),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }
  */

  getBaseCategories(): Observable<Category[]> {
    const api = `${environment.apiBaseUrl}/api/categories`;
    return this.http.get(api, httpOptions)
      .pipe(
        // on fait le mapping de chaque item pour instancier une Category
        map((jsonArray: object[]) => jsonArray.map(jsonItem => Category.fromJson(jsonItem))),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }


  wrapApiBaseError(error: HttpErrorResponse): any {
    return {
      errorCode: error.status,
      errorMessage: this.buildErrorMessage(error)
    };
  }


  /** My Payment API */

  getPaymentToken(): Observable<any> {
    const api = `${environment.apiBaseUrl}/api/payment/token`;
    return this.http.get(api, httpOptions)
      .pipe(
        // no mapping
        map((jsonArray: object[]) => jsonArray),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }

  postSubscriptionWithPayment(orderBodyWithPayment): Observable<Subscription> {
    const api = `${environment.apiBaseUrl}/api/payment/subscription`;
    return this.http.post(api, orderBodyWithPayment, httpOptions)
      .pipe(
        // on fait le mapping du json pour instancier une Subscription
        map((json: object) => Subscription.fromJson(json)),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.wrapApiBaseError(error));
        })
      );
  }


  buildErrorMessage(error: HttpErrorResponse): string {
    let errorMessage = '';

    if (error && typeof error === 'object' && error.hasOwnProperty('error') && error.error !== null) {
      if (error.error instanceof ErrorEvent) {
        // client-side error
        errorMessage = error.error.message;
      } else {
        // server-side error, user oriented message => error: { error: "Unauthorized", error_description: "Token or apiKey is missing." }
        if (typeof error.error === 'object') {
          if (typeof error.error.error === 'string') {
            errorMessage = `${error.error.error} (${error.status})`;
            if (typeof error.error.error_description === 'string') {
              errorMessage += ' : ' + error.error.error_description;
            }
          } else {
            if (typeof error.error.​​detail === 'string') {
              const intro = typeof error.error.title === 'string' ? `${error.error.title} - ` : '';
              errorMessage = `${intro}${error.error.​​detail}`;
            } else {
              if (typeof error.error.message === 'string') {
                errorMessage = `${error.error.message}`;
              }
            }
          }
        } else {
          const mstText = typeof error.statusText === 'string' ? error.statusText : error.message;
          errorMessage = `Code: ${error.status}\nMessage: ${mstText}`;
        }
      }
    } else {
      if (error && typeof error === 'object' && error.hasOwnProperty('status')) {
        let mstText = '';
        if (error.hasOwnProperty('statusText') && typeof error.statusText === 'string') {
          mstText = error.statusText;
        } else {
          if (error.hasOwnProperty('message') && typeof error.message === 'string') {
            mstText = error.message;
          }
        }
        errorMessage = `Code: ${error.status}\nMessage: ${mstText}`;
      }
    }

    if (errorMessage === '') {
      if (error && typeof error === 'object' && error.hasOwnProperty('statusText')) {
        errorMessage = error.statusText;
      } else {
        errorMessage = 'Unknown Error';
      }
    }

    // return the error message
    return errorMessage;
  }

  // Error
  handleError(error: HttpErrorResponse) {
    // return an observable with a user-facing error message
    return throwError(this.buildErrorMessage(error));
  }

  getHeerToken(): string {
    return this.browserService.getLocalStorageItem(keyHeerToken);
  }

  setHeerToken(newToken: string): void {
    this.browserService.setLocalStorageItem(keyHeerToken, newToken);
  }

}
