import { NgModule } from '@angular/core';
import { ServerModule, ServerTransferStateModule } from '@angular/platform-server';
import { BrowserModule } from '@angular/platform-browser';

import { AppModule } from './app.module';
import { AppComponent } from './app.component';

// https://andremonteiro.pt/ngx-translate-angular-universal-ssr/
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { translateServerLoaderFactory } from './modules/general/loaders/translate-server.loader';
import { TransferState } from '@angular/platform-browser';

@NgModule({
  imports: [
    AppModule,
    ServerModule,
    ServerTransferStateModule,
    BrowserModule.withServerTransition({ appId: 'serverApp' }),
    TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: translateServerLoaderFactory,
        deps: [TransferState]
      }
    })
  ],
  bootstrap: [AppComponent],
})
export class AppServerModule {}
