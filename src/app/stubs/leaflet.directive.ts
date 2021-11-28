import { Directive, Input, OnInit, OnChanges } from '@angular/core';

/**
 * this class stubs out ngx-leaflet's LeafletDirective for loading server-side
 * you don't need any of this functionality on the server
 */
@Directive({
    // eslint-disable-next-line @angular-eslint/directive-selector
    selector: '[leaflet]'
  })
  export class LeafletDirective implements OnInit, OnChanges  {
  
    @Input() leafletOptions: string;
  
    ngOnInit() {
      console.log('[debug] LeafletDirective (from stubs), OnInit '); // , this.leafletOptions);
    }
    ngOnChanges() {
      console.log('[debug] LeafletDirective (from stubs), OnChanges ');
    }
  }