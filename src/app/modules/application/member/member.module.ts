import { NgModule, LOCALE_ID } from '@angular/core';
import { CommonModule } from '@angular/common';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { ClipboardModule } from '@angular/cdk/clipboard';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { LeafletModule } from '@asymmetrik/ngx-leaflet';
import { EditorModule, TINYMCE_SCRIPT_SRC } from '@tinymce/tinymce-angular';
import { GeoapifyGeocoderAutocompleteModule } from '@geoapify/angular-geocoder-autocomplete';

import { MemberRoutingModule } from './member-routing.module';
import { MemberComponent } from './member.component';
import { PreferencesComponent } from './preferences/preferences.component';
import { SubscriptionOrderComponent } from './order/subscription-order.component';
import { InvoiceSearchComponent } from './invoice/invoice-search.component';
import { AddressComponent } from '../address/address.component';
import { FormAddressComponent } from '../address/form/form-address.component';
import { FormShopComponent } from '../address/merchant/shop/form-shop.component';
import { MessagesComponent } from '../address/merchant/messages/messages.component';
import { FormMessageComponent } from '../address/merchant/messages/form/form-message.component';
import { VicinityComponent } from '../vicinity/vicinity.component';
import { PlaceItemComponent } from '../vicinity/place-item.component';
import { FormVicinityComponent } from '../vicinity/form/form-vicinity.component';
import { MapVicinityComponent } from '../vicinity/map/map-vicinity.component';
import { SearchVicinityComponent } from '../vicinity/search/search-vicinity.component';
import { IndividualComponent } from '../address/individual/individual.component';
import { LookingForListItemComponent } from '../address/individual/lookingFor-listItem.component';
import { FormLookingForComponent } from '../address/individual/form/form.lookingFor.component';
import { LookingForComponent } from '../vicinity/looking-for/looking-for.component';
import { ListItemLookingForComponent } from '../vicinity/looking-for/list-item.component';
import { AnswerComponent } from '../vicinity/looking-for/answer/answer.component';
import { environment } from 'src/environments/environment';

registerLocaleData(localeFr);

export function TranslationLoaderFactory(http: HttpClient) {
  return new TranslateHttpLoader(http);
}

@NgModule({
  imports: [
    CommonModule,
    MemberRoutingModule,
    HttpClientModule,
    TranslateModule.forChild({
      loader: {provide: TranslateLoader, useFactory: TranslationLoaderFactory, deps: [HttpClient]}
    }),
    FormsModule,
    ReactiveFormsModule,
    NgSelectModule,
    ClipboardModule,
    NgbModule,
    LeafletModule,
    EditorModule,
    GeoapifyGeocoderAutocompleteModule.withConfig(environment.geoapifykey)
  ],
  exports: [
    MemberComponent,
  ],
  declarations: [
    MemberComponent,
    PreferencesComponent,
    SubscriptionOrderComponent,
    InvoiceSearchComponent,
    AddressComponent,
    FormAddressComponent,
    FormShopComponent,
    MessagesComponent,
    FormMessageComponent,
    VicinityComponent,
    PlaceItemComponent,
    FormVicinityComponent,
    MapVicinityComponent,
    SearchVicinityComponent,
    IndividualComponent,
    LookingForListItemComponent,
    FormLookingForComponent,
    LookingForComponent,
    ListItemLookingForComponent,
    AnswerComponent,
  ],
  providers: [
    { provide: TINYMCE_SCRIPT_SRC, useValue: 'tinymce/tinymce.min.js' }
  ],
})
export class MemberModule { }
