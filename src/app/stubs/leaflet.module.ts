import { NgModule } from '@angular/core';
import { LeafletDirective } from './leaflet.directive';

/**
 * this class stubs out ngx-leaflet's LeafletModule for loading server-side
 * you don't need any of this functionality on the server
 */
@NgModule({
  declarations: [ LeafletDirective ],
  exports: [ LeafletDirective ],
})
export class LeafletModule { }
