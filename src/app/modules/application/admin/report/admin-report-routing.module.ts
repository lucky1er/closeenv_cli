import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { AdminReportComponent } from './admin-report.component';
import { ReportUsersComponent } from './users/report-users.component';
import { ReportInvoicingComponent } from './invoicing/report-invoicing.component';

const routes: Routes = [
  {
    path: 'home', component: AdminReportComponent,
    /* children: [
      //{ path: 'subscrip/:id', component: SubscriptionOrderComponent },
      //{ path: 'address', component: AddressComponent },
      //{ path: '', redirectTo: 'address', pathMatch: 'full' },
      //{ path: '**', component: NotFoundComponent }
    ] */
  },
  { path: 'users', component: ReportUsersComponent },
  { path: 'invoicing', component: ReportInvoicingComponent },
  { path: '**', redirectTo: 'home', pathMatch: 'full' },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminReportRoutingModule { }
