import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { serialize, deserialize } from '@peerlancers/json-serialization';

@Injectable({
    providedIn: 'root'
})
export class BrowserService {

  errorTimeout = 7;
  lastPosition: GeolocationPosition;

  // Create an Observable to listen asynchronous geolocation.getCurrentPosition
  public geoLocateObs = new Observable<GeolocationPosition>((observer) => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(position => {
        // success callback
        observer.next(position);
        observer.complete();
      }, error => {
        // error callback
        console.warn('getCurrentPosition error ', error);
        if (error.code === 3) {
          // timeout => a second try
          navigator.geolocation.getCurrentPosition(positionAgain => {
            // nested success callback
            observer.next(positionAgain);
            observer.complete();
          }, errorAgain => {
            // nested error callback
            console.error('getCurrentPosition error again ', errorAgain);
            observer.error('Geolocation error');
          });
        } else {
          observer.error(error.message);
        }
      }, {} /* default options */);
    } else {
      observer.error('Geolocation not available');
    }
  });

  public isLocalStorageSupported(): boolean {
    return (typeof localStorage !== 'undefined');
  }

  public getLocalStorageItem(lsKey: string): any {
    // functionality not available neither with SSR nor on all browsers
    let stringValue: string;
    let lsValue: any = '';
    if (this.isLocalStorageSupported()) {
      stringValue = localStorage.getItem(lsKey);
      if (stringValue && stringValue.startsWith('{"')) {
        // serialized object
        lsValue = JSON.parse(stringValue);
      } else {
        lsValue = stringValue;
      }
    }
    return lsValue;
  }

  public setLocalStorageItem(lsKey: string, lsValue: any): boolean {
    // functionality not available neither with SSR nor on all browsers
    let result = false;
    let stringValue: string;
    if (this.isLocalStorageSupported()) {
      if (typeof lsValue === 'object') {
        stringValue = JSON.stringify(lsValue);
      } else {
        stringValue = lsValue;
      }
      localStorage.setItem(lsKey, stringValue);
      result = true;
    }
    return result;
  }

  public setLocalStorageSerializable(lsKey: string, lsSerializable: any): boolean {
    // functionality not available neither with SSR nor on all browsers
    let result = false;

    if (this.isLocalStorageSupported()) {
      localStorage.setItem(lsKey, JSON.stringify(serialize(lsSerializable)));
      result = true;
    }

    return result;
  }

  public getLocalStorageSerializable(lsKey: string): any {
    // functionality not available neither with SSR nor on all browsers
    let stringValue: string;
    let lsObject: any = null;
    if (this.isLocalStorageSupported()) {
      stringValue = localStorage.getItem(lsKey);
      if (stringValue && (stringValue.startsWith('[') || stringValue.startsWith('{'))) {
        // deserialize to populate an object
        lsObject = JSON.parse(stringValue); // deserialize(Object, JSON.parse(stringValue));
      } else {
        lsObject = stringValue;
      }
    }
    return lsObject;
  }

  public removeLocalStorageItem(lsKey: string): boolean {
    let result = false;
    if (this.isLocalStorageSupported()) {
      localStorage.removeItem(lsKey);
      result = true;
    }
    return result;
  }
}
