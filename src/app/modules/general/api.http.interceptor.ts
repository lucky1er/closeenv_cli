import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, of, throwError } from 'rxjs';
import { catchError, switchMap, finalize, filter, take } from 'rxjs/operators';

import { AuthService } from './service/auth.service';
import { ApiHttpService } from './service/api.http.service';
import { environment } from '../../../environments/environment';
import { Place } from 'src/app/model/place';

@Injectable()

export class ApiHttpInterceptor implements HttpInterceptor {
  private isRefreshingTokenHeer = false;
  private mostRecentTokenSource = new BehaviorSubject<any>(null);

  constructor(
    private authService: AuthService,
    private apiHttpService: ApiHttpService) { }

  intercept(req: HttpRequest<any>, next: HttpHandler) {
    let authToken = 'NONE';
    let isHeerReq = false;
    const apiBaseUrl = environment.apiBaseUrl + environment.apiCommonWay;

    if (req.url.indexOf(apiBaseUrl) !== -1) {
      // add Authorization Bearer with main token
      authToken = this.authService.getToken();
    }
    if (req.url.indexOf(environment.apiHeerUrl) !== -1) {
        // add Authorization Bearer with heer token
        authToken = this.apiHttpService.getHeerToken();
        isHeerReq = true;
    }

    if (authToken === 'NONE') {
        return next.handle(req);
    }

    return next.handle(this.addTokenToRequest(req, authToken))
      .pipe(
        // gestion d'erreurs propre aux requêtes avec token
        catchError(
          (err) => {
            if (err && (err.status === 401 /* Unauthorized */ || err.status === 403 /* Forbidden */)) {
              if (isHeerReq) {
                return this.handleInvalidToken<Place[]>(err, req, next);
              } else {
                // remonter la HttpErrorResponse jusqu'au composant ou service ayant fait l'appel http
                return throwError(err);
              }
            }

            if (isHeerReq) {
              // default error handler
              return this.handleErrorDefault(err);
            } else {
              // remonter la HttpErrorResponse jusqu'au composant ou service ayant fait l'appel http
              return throwError(err);
            }
          }
        )
      );
  }

  private addTokenToRequest(request: HttpRequest<any>, token: string) {
    return request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  handleErrorDefault<T>(error: HttpErrorResponse) {
    // return an observable with a user-facing error message
    return throwError(this.apiHttpService.buildErrorMessage(error));
  }

  handleInvalidToken<T>(originError: HttpErrorResponse, request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (request.url.indexOf(environment.apiHeerUrl) !== -1) {
      if (this.isRefreshingTokenHeer) {
        // refresh-token pending...
        return this.mostRecentTokenSource.pipe(
          filter(token => token != null),
          take(1),
          switchMap((token: any) => {
            return next.handle(this.addTokenToRequest(request, token.accessToken));
          }),
        );
      } else {
        // token to refresh
        this.isRefreshingTokenHeer = true;
        this.mostRecentTokenSource.next(null);
        return this.apiHttpService.getBackHeerAccessToken()
          .pipe(
            finalize(() => {
              this.isRefreshingTokenHeer = false;
            }),
            switchMap(newTokenResp => {
              // must return an Observable
              this.mostRecentTokenSource.next(newTokenResp.access_token);
              return next.handle(this.addTokenToRequest(request, newTokenResp.access_token));
            }),
            catchError(error => {
              // refresh-token failed => return an observable with a user-facing error message
              return throwError(this.apiHttpService.buildErrorMessage(error));
            }),
          );
      }
    } else {
      // connection to renew
      return throwError(this.apiHttpService.buildErrorMessage(originError));
    }
  }
}
