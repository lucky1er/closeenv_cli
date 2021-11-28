import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { FormsModule } from '@angular/forms';
import { AdminReportRoutingModule } from './admin-report-routing.module';
import { AdminReportComponent } from './admin-report.component';
import { ReportUsersComponent } from './users/report-users.component';
import { ReportInvoicingComponent } from './invoicing/report-invoicing.component';

export function TranslationLoaderFactory(http: HttpClient) {
  return new TranslateHttpLoader(http);
}

@NgModule({
  imports: [
    CommonModule,
    AdminReportRoutingModule,
    HttpClientModule,
    TranslateModule.forChild({
      loader: {provide: TranslateLoader, useFactory: TranslationLoaderFactory, deps: [HttpClient]}
    }),
    FormsModule
  ],
  exports: [
    AdminReportComponent,
  ],
  declarations: [
    AdminReportComponent,
    ReportUsersComponent,
    ReportInvoicingComponent
  ],
})
export class AdminReportModule { }
