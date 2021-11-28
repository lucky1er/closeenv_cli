import { Component, OnInit, Input, Output, EventEmitter, AfterViewInit, OnDestroy } from '@angular/core';
import cloneDeep from 'lodash-es/cloneDeep';

import { MapComponentService, nbMaxTop } from 'src/app/modules/general/map/map.component.service';
import { Place } from 'src/app/model/place';

@Component({
  selector: 'app-map-vicinity',
  templateUrl: './map-vicinity.component.html',
  styleUrls: ['./map-vicinity.component.css']
})
export class MapVicinityComponent implements OnInit, OnDestroy {

  @Input() centralCoords: any;
  @Input() closePlaces: Place[];
  @Output() closeComponent = new EventEmitter<boolean>();

  constructor(public mapService: MapComponentService) { }

  ngOnInit(): void {
    // limiter aux 20 premiers items de la liste this.closePlaces
    const top20 = [];
    if (this.closePlaces && this.closePlaces.length) {
      for (const place of this.closePlaces) {
        top20.push(cloneDeep(place)); // object deep copy (with lodash's method)
        if (top20.length >= nbMaxTop) {
          break;
        }
      }
    }
    // console.log('[DEBUG] ctrl top20 ', top20.length);
    this.mapService.resetMapOptions(this.centralCoords, top20);
  }

  backToParent(): void {
    this.mapService.destroyMapOptions();
    this.closeComponent.emit(true);
  }

  ngOnDestroy(): void {
    this.mapService.destroyMapOptions();
  }
}
