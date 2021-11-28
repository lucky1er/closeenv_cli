import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';

import { ChartjsComponent } from './chartjs.component';
import { ChartjsRoutingModule } from './chartjs-routing.module';
import { ChartsModule } from 'ng2-charts';

export function TranslationLoaderFactory(http: HttpClient) {
  return new TranslateHttpLoader(http);
}

@NgModule({
  imports: [
    CommonModule,
    ChartjsRoutingModule,
    ChartsModule,
    TranslateModule.forChild({
      loader: {provide: TranslateLoader, useFactory: TranslationLoaderFactory, deps: [HttpClient]}
    }),
  ],
  exports: [
    ChartjsComponent
  ],
  declarations: [
    ChartjsComponent
  ],
  providers: [
  ],
})
export class ChartjsModule { }
