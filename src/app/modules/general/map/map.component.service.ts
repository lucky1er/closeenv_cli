import { Injectable, PLATFORM_ID, Inject, Output, EventEmitter } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { MapOptions, Map, Marker, Circle } from 'leaflet';
import { Place } from '../../../model/place';

const tilay = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
// 'https://{a}.tile.openstreetmap.org/${z}/${x}/${y}.png' --> cf. https://wiki.openstreetmap.org/wiki/Tiles#Servers
const attrn = 'Map data © OpenStreetMap contributors';
const zoomd = 12;
const zoomx = 19;
const smallestRadiusDistance = 1000;
const circleRadiusMinimum = 1500;
const radiusSafetyMargin = 500;
const defaultFlagMarkerColor = 'orangered'; // darkorchid | mediumblue
export const nbMaxTop = 20;

@Injectable({
    providedIn: 'root'
})
export class MapComponentService {

  public L = null;
  map: Map;
  mapOptions: MapOptions;
  radiusCircle: Circle;
  closeMarkers: Marker[];
  closePlacesToMark: Place[];
  private errorGettingPlaces: any = {};
  private myCentralPoint;

  constructor(
    @Inject(PLATFORM_ID) private  platformId: object)  {
    // console.log('[debug] MapComponentService constructor ', this.mapOptions);
    this.mapOptions = null;
    if (isPlatformBrowser(platformId)) {
      this.L = require('leaflet');
    } else {
      // console.log('[SSR] MapComponentService, not Browser ', platformId);
    }
  }

  getMapOptions(): MapOptions {
    // console.log('[debug] MapComponentService, getMapOptions ', this.mapOptions);
    return this.mapOptions;
  }

  resetMapOptions(userCoords: any, nearbyPlaces: Place[]): any {
    if (this.L) {
      // console.log('[DEBUG] resetMapOptions ', userCoords);
      this.closePlacesToMark = nearbyPlaces;
      const lat = (userCoords && userCoords.latitude) ? userCoords.latitude : 51;
      const lng = (userCoords && userCoords.longitude) ? userCoords.longitude : 0;
      const addressA = (userCoords && userCoords.addressLabel);
      const addressB = (userCoords && userCoords.address1);
      const addressC = (userCoords && userCoords.address);
      const address = addressA ? userCoords.addressLabel
        : (addressB ? userCoords.address1 : (addressC ? userCoords.address : ''));
      // console.log('ctrl resetMapOptions', lat, lng, address);

      this.myCentralPoint = this.L.marker([ lat, lng ], {
        icon: this.L.icon({
          iconSize: [ 21, 35 ],
          iconAnchor: [ 13, 41 ],
          iconUrl: 'leaflet/marker-icon.png',
          shadowUrl: 'leaflet/marker-shadow.png'
        })
      });
      if (address !== '') {
        if (this.L.Browser.mobile) {
          this.myCentralPoint.bindPopup(address);
        } else {
          this.myCentralPoint.bindTooltip(address); // .on('click', (ev) => { this.myCentralPoint.toggleTooltip(); } );
        }
      }

      this.mapOptions = {
        center: this.L.latLng(lat, lng),
        zoom: zoomd,
        layers: [
          /*this.L.tileLayer.provider('HEREv3.terrainDay', {
            apiKey: '3Dbn_qqeCnX-6TzdEJg5KTgKxp2E_UVg53FsbMJVJ8c'
          }),*/
          /*--*/
          this.L.tileLayer(
            tilay,
            {
              maxZoom: zoomx,
              attribution: attrn
            }
          ),
          /*--*/
          this.myCentralPoint
        ],
      };

      /*---
      if (this.map) {
        //this.map.off();
        of(keyWaitForDomAvailable).pipe(delay(100)).subscribe(value => {
          this.map.setView(this.map.getCenter(), this.map.getZoom()); //this.map.setView([ lat, lng ], zoomd);
        });
      }
      ---*/
    } else {
      // console.warn('[debug] resetMapOptions, leaflet not yet initialized !');
    }
  }

  onMapReady(map: Map) {
    this.map = map;
    if (this.mapOptions) {
      this.addCloseMarkers();
    }
  }

  refreshWithMarkers(newPlaces: Place[], replacingPrevious : boolean = false): void {
    // console.log('[debug] Map Service > refreshWithMarkers ');
    this.closePlacesToMark = newPlaces;
    if (replacingPrevious ) {
      if (this.radiusCircle) {
        this.radiusCircle.remove();
      }
      if (this.closeMarkers) {
        for (const marker of this.closeMarkers) {
          marker.remove();
        }
      }
    }
    this.addCloseMarkers();
  }

  addCloseMarkers(): void {
    if (this.L && typeof this.closePlacesToMark !== 'undefined' && this.closePlacesToMark !== null && this.closePlacesToMark.length) {
      let longestDistance = 0;
      const setOfMarkers = [this.myCentralPoint];
      this.closeMarkers = [];
      // generate a marker for each nearby place (in this.closePlacesToMark)
      for (const entry of this.closePlacesToMark) {
        const lat = entry.positionLat;
        const lng = entry.positionLng;
        const placeFlag = (entry.flags && entry.flags.length);
        const markerIcon = placeFlag ? 'fa-map-marker' : 'fa-map-marker-alt';
        const markerColor = placeFlag ? defaultFlagMarkerColor : 'rgb(82, 30, 24)';
        const markerOpacity = placeFlag ? 0.6 : 0.5;
        const iconDiv = this.L.divIcon({
          html: '<i class="fas ' + markerIcon + ' fa-3x" style="color: ' + markerColor + '"></i>',
          // <i class="fas fa-map-pin"></i>
        });
        const newMarker: Marker = this.L.marker([ lat, lng ], {
          icon: iconDiv,
          opacity: markerOpacity
        });
        newMarker.addTo(this.map);
        this.closeMarkers.push(newMarker);
        if (setOfMarkers.length < nbMaxTop) {
          setOfMarkers.push(newMarker);
          if (longestDistance < entry.distance) {
            longestDistance = entry.distance;
          }
        }
        if (this.L.Browser.mobile) {
          newMarker.bindPopup(entry.title);
        } else {
          newMarker.bindTooltip(entry.title);
          // newMarker.on('click', (ev) => { newMarker.toggleTooltip(); } );
        }
      }
      let circleRadius = longestDistance + radiusSafetyMargin;
      // console.log('[DEBUG] ctrl condition map zoom ', longestDistance, smallestRadiusDistance, setOfMarkers.length);
      // controle validité du rayon par défault
      if (longestDistance < smallestRadiusDistance) {
        circleRadius = circleRadiusMinimum;
        // forcer un zoom ++
        const markersGroup = new this.L.featureGroup(setOfMarkers);
        this.map.fitBounds(markersGroup.getBounds());
        this.radiusCircle = null;
      } else {
        // matérialiser le cercle "rapproché"
        this.radiusCircle = this.L.circle(this.mapOptions.center, {
          color: 'green',
          fillColor: '#a3a375',
          fillOpacity: 0.3,
          radius: circleRadius
        }).addTo(this.map);
      }
    }
  }

  getDistanceBetweenTwoPoints(pointA: any, pointB: any): number {
    let estimatedDistance = null;
    if (this.L && pointA.latitude && pointA.longitude && pointB.latitude && pointB.longitude) {
      const from = this.L.latLng(pointA.latitude, pointA.longitude);
      const to = this.L.latLng(pointB.latitude, pointB.longitude);
      estimatedDistance = parseInt(from.distanceTo(to), 10); // distance in meters
    }
    return estimatedDistance;
  }

  destroyMapOptions(): void {
    // console.log('[debug] MapComponentService destroyMapOptions() ...');
    if (this.mapOptions) {
      //if(this.map) {
      //  this.map.off();
      //  this.map.remove();
      //}
      for (const key in this.mapOptions) {
        if (this.mapOptions.hasOwnProperty(key)) {
          delete this.mapOptions[key];
        }
      }
      this.mapOptions = null;
    }
  }

  isErrorGettingPlaces(): boolean {
    let boolErrorGettingPlaces = false;
    if (typeof this.errorGettingPlaces === 'object' && typeof this.errorGettingPlaces.message === 'string'
    && this.errorGettingPlaces.message !== '') {
      boolErrorGettingPlaces = true;
    }
    return boolErrorGettingPlaces;
  }

  getErrorGettingPlacesMessage(): string {
    let errorMessage = '';
    if (typeof this.errorGettingPlaces === 'object' && typeof this.errorGettingPlaces.message === 'string'
      && this.errorGettingPlaces.message !== '') {
      errorMessage = this.errorGettingPlaces.message;
    }
    return errorMessage;
  }

  setErrorGettingPlacesMessage(message: string): void {
    this.errorGettingPlaces.message = message;
  }

  removeErrorGettingPlaces(): void {
    this.errorGettingPlaces.message = null;
  }
}
