import { Injectable, Inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { User } from '../../../model/user';
import { Observable, throwError, of } from 'rxjs';
import { catchError, map, delay } from 'rxjs/operators';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { BrowserService } from './browser.service';
import { environment } from '../../../../environments/environment';
import { ApiHttpService, keyBaseUser } from './api.http.service';

const keyBaseToken = 'jet_on_base';
const keyLastConnectivity = 'jet_on_line';
const keyJsonCurrentOffers = 'availOffers';
const keyJsonNextSubscription = 'dateForNextSubscription';
const keyFirstUserAddress = 'idAddress1';
const numberSecondsUserValidity = 300;
const numberSecondsUserValidityOffline = 432000;

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  headers = new HttpHeaders().set('Content-Type', 'application/json');
  private userLoggedIn: User = null;
  private userLastRefresh = 0;
  private userLastRefreshWithConnectivity = null;
  private vicinityRouteActive = false;
  public currentOffers: any;
  public nextSubscriptionDate: any;
  activeUserSubscription = false;
  userAddressActive = 0;

  constructor(
    private browserService: BrowserService,
    public apiHttpService: ApiHttpService,
    @Inject(DOCUMENT) private document: Document,
    private http: HttpClient,
    public router: Router
  ) {
    this.userLastRefreshWithConnectivity = this.browserService.getLocalStorageItem(keyLastConnectivity);
    if (!this.userLastRefreshWithConnectivity) {
      this.userLastRefreshWithConnectivity = 0;
    }
    if (typeof this.userLastRefreshWithConnectivity === 'string') {
      if (this.userLastRefreshWithConnectivity === '') {
        this.userLastRefreshWithConnectivity = 0;
      } else {
        // convert to integer parseInt(this.userLastRefreshWithConnectivity, 10)
        this.userLastRefreshWithConnectivity = +this.userLastRefreshWithConnectivity;
      }
    } else {
      if (typeof this.userLastRefreshWithConnectivity !== 'number' && typeof this.userLastRefreshWithConnectivity !== 'bigint') {
        this.userLastRefreshWithConnectivity = 0;
      }
    }

    if (isNaN(this.userLastRefreshWithConnectivity)) {
      this.userLastRefreshWithConnectivity = 0;
    }
  }

  setUserDataFromJson(jsonMe: any) {
    this.userLoggedIn = User.populateFromJson(jsonMe);
    this.userLastRefresh = this.getNowSeconds();
    if (!this.apiHttpService.isOffline()) {
      this.userLastRefreshWithConnectivity = this.userLastRefresh;
      this.browserService.setLocalStorageItem(keyLastConnectivity, this.userLastRefreshWithConnectivity);
    }

    if (jsonMe.hasOwnProperty(keyJsonNextSubscription)) {
      this.nextSubscriptionDate = jsonMe[keyJsonNextSubscription];
    }
    if (jsonMe.hasOwnProperty(keyJsonCurrentOffers)) {
      this.currentOffers = jsonMe[keyJsonCurrentOffers];
    }
    if (jsonMe.hasOwnProperty(keyFirstUserAddress)) {
      this.userAddressActive = jsonMe[keyFirstUserAddress];
    }
  }

  getNowSeconds(): number {
    const nowMilliseconds = Date.now();
    return Math.round(nowMilliseconds / 1000);
  }

  lastUserRefreshOutdated(): boolean {
    const userDuration = this.getNowSeconds() - this.userLastRefresh;
    return (userDuration > numberSecondsUserValidity);
  }

  lastUserRefreshWithConnectivityOutdated(): boolean {
    const userDuration = this.getNowSeconds() - this.userLastRefreshWithConnectivity;
    return (userDuration > numberSecondsUserValidityOffline);
  }

  // Sign-up
  signUp(user: User): Observable<any> {
    const api = `${environment.apiBaseUrl}/sign/up`;
    return this.http.post(api, user)
      .pipe(
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.apiHttpService.buildErrorMessage(error));
        })
      );
  }

  // Sign-in
  signIn(user: User) {
    return this.http.post<any>(`${environment.apiBaseUrl}/sign/in`, user)
      .pipe(
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.apiHttpService.buildErrorMessage(error));
        })
      );
  }

  // Password-reset
  passwordReset(pwdWrap: any): Observable<any> {
    const api = `${environment.apiBaseUrl}/sign/reset`;
    return this.http.post(api, pwdWrap)
      .pipe(
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.apiHttpService.buildErrorMessage(error));
        })
      );
  }

  // Password-renew (processes "forgotten password" requests)
  passwordNewRequest(emailWrap: any): Observable<any> {
    const api = `${environment.apiBaseUrl}/sign/renew`;
    return this.http.post(api, emailWrap)
      .pipe(
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.apiHttpService.buildErrorMessage(error));
        })
      );
  }

  setCurrentUser(newToken: string, whoami: string): void {
    let iriUser = this.userLoggedIn ? this.userLoggedIn.iri : null;

    this.browserService.setLocalStorageItem(keyBaseToken, newToken);

    this.apiHttpService.connectivityChecking()
      .subscribe(connectivityResult => { // nothing to do here (all is done on complete)
      }, errorToSkip => { // nothing to do
      }, () => {
        // Connectivity checking is complete => always follow with the api-me
        this.apiMeObservable(whoami).subscribe(resultMe => {
          if (!iriUser && resultMe['@id']) {
            iriUser = resultMe['@id'];
          }
          this.setUserDataFromJson(resultMe);
          this.browserService.setLocalStorageSerializable(
            keyBaseUser,
            { user: this.userLoggedIn.email, no: this.apiHttpService.getIdFromIri(iriUser) }
          );
          this.router.navigate(['member']);
        }, errorMe => {
          console.warn('me error (from auth.service) ', errorMe);
          if (errorMe.errorCode && errorMe.errorCode === 503 && !this.isUserAdmin()) {
            // Application under maintenance
            this.userLoggedIn = null; // pour forcer nouveau getMe() dans MemberComponent.ngOnInit()
            this.router.navigate(['member']);
          }
        });
      });
  }

  apiMeObservable(uid: string = null): Observable<any> {
    const lgo = this.browserService.getLocalStorageSerializable(keyBaseUser);
    if (!uid) {
      uid = (lgo && typeof lgo === 'object' && lgo.hasOwnProperty('user')) ? lgo.user : '0';
    }
    const api = `${environment.apiBaseUrl}/api/me/${uid}`;

    return this.http.get(api, { headers: this.headers })
      .pipe(
        // le resultat json est retourné tel-quel (sans mapping)
        map(result => {
          return result;
        }),
        catchError(error => {
          // return an observable with a user-facing error message
          return throwError(this.apiHttpService.wrapApiBaseError(error));
        })
      );
  }

  shouldUserBeRefreshed(): boolean {
    return (!this.userLoggedIn && this.getToken() !== null);
  }

  get userConnected() {
    return this.userLoggedIn;
  }

  isTokenRecovered(): boolean {
    return (this.browserService.getLocalStorageItem(keyBaseToken) !== null);
  }

  isUserRecovered(): boolean {
    return (this.isTokenRecovered() && this.browserService.getLocalStorageSerializable(keyBaseUser) !== null);
  }

  isUserAdmin(): boolean {
    return (this.userLoggedIn && this.userLoggedIn.admin);
  }

  getToken(): string {
    return this.browserService.getLocalStorageItem(keyBaseToken);
  }
/*
  setToken(newToken: string): void {
    this.browserService.setLocalStorageItem(keyBaseToken, newToken);
  }
*/
  get isLoggedIn(): boolean {
    return (this.userLoggedIn !== null);
  }

  get isVicinityRouteActive(): boolean {
    return (this.vicinityRouteActive === true);
  }

  checkActiveRoute(newActiveRoute: string): void {
    // console.log('[DEBUG] route change ', newActiveRoute);
    this.vicinityRouteActive = newActiveRoute.startsWith('/member/vicinity/');
  }

  checkTokenExpiration(error, timeout: number, warning = false): void {
    if ((error.errorCode === 401 || error.errorCode === 503) && !this.apiHttpService.isOffline()) {
      // temporiser pour laisser le temps à l'utilisateur de voir message
      const fakeObservable = of('session-expired').pipe(delay(timeout))
        .subscribe(value => {
          this.removeToken();
          this.document.location.reload();
        });
    } else {
      if (warning) {
        console.warn('API call error ', error);
      }
    }
  }

  removeToken(): void {
    this.browserService.removeLocalStorageItem(keyBaseToken);
    this.browserService.removeLocalStorageItem(keyBaseUser);
    this.userLoggedIn = null;
  }

}
