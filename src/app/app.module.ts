import { BrowserModule, TransferState } from '@angular/platform-browser';
import { NgModule, APP_INITIALIZER, LOCALE_ID } from '@angular/core';
import { HttpClient, HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { LeafletModule } from '@asymmetrik/ngx-leaflet';
import { GeoapifyGeocoderAutocompleteModule } from '@geoapify/angular-geocoder-autocomplete';

import { AppComponent } from './app.component';
import { HomeComponent } from './modules/general/home/home.component';
import { RelocateComponent } from './modules/general/relocate/relocate.component';
import { PrivacyPolicyComponent } from './modules/general/privacy-policy/privacy-policy.component';
import { AssociationComponent } from './modules/general/association/association.component';
import { NotFoundComponent } from './modules/general/not-found/not-found.component';
import { MapComponent } from './modules/general/map/map.component';
import { AppRoutingModule } from './app-routing.module';
import { ApiHttpInterceptor } from './modules/general/api.http.interceptor';

// en commentaire ci-dessous, les composants et modules gérés en mode Lazy Loading
// import { ChartjsComponent } from './modules/application/chartjs/chartjs.component';
// import { ChartjsModule } from './modules/application/chartjs/chartjs.module';

// https://andremonteiro.pt/ngx-translate-angular-universal-ssr/
import { TransferHttpCacheModule } from '@nguniversal/common';
import { translateBrowserLoaderFactory } from './modules/general/loaders/translate-browser.loader';

import { AppConfigService } from './app.config.service';
import { AuthService } from './modules/general/service/auth.service';
import { ApiHttpService } from './modules/general/service/api.http.service';
import { BrowserService } from './modules/general/service/browser.service';
import { LocationService } from './modules/general/service/location.service';
import { MapComponentService } from './modules/general/map/map.component.service';
import { AddOnTranslationService } from 'src/app/modules/general/service/addOn.translation.service';
import { environment } from '../environments/environment';

export function TranslationLoaderFactory(http: HttpClient) {
  return new TranslateHttpLoader(http);
}

const theImports = [
  BrowserModule.withServerTransition({ appId: 'serverApp' }),
  TransferHttpCacheModule,
  AppRoutingModule,
  HttpClientModule,
  TranslateModule.forRoot({
    loader: {
      provide: TranslateLoader,
      useFactory: translateBrowserLoaderFactory,
      deps: [HttpClient, TransferState]
    }
  }),
  LeafletModule,
  FormsModule,
  ReactiveFormsModule,
  GeoapifyGeocoderAutocompleteModule.withConfig(environment.geoapifykey)
];
const theDeclarations = [
  AppComponent,
  HomeComponent,
  RelocateComponent,
  NotFoundComponent,
  MapComponent,
  PrivacyPolicyComponent,
  AssociationComponent
];

@NgModule({
  declarations: theDeclarations,
  imports: theImports,
  providers: [
    AppConfigService,
    /*-- {
      provide: APP_INITIALIZER,
      multi: true,
      deps: [AppConfigService],
      useFactory: (appConfigService: AppConfigService) => {
        return () => {
          // the following loadAppConfig() function must return a promise !
          return appConfigService.loadAppConfig();
        };
      }
    }, --*/
    {
      provide: HTTP_INTERCEPTORS,
      useClass: ApiHttpInterceptor,
      multi: true
    },
    AuthService,
    ApiHttpService,
    BrowserService,
    LocationService,
    MapComponentService,
    AddOnTranslationService,
    /*{
      provide: LOCALE_ID,
      useFactory: (addonTranslationService: AddOnTranslationService) => addonTranslationService.getDeterminedLocale(),
      deps: [AddOnTranslationService]
    }*/
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
}
