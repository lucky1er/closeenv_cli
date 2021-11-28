import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { MemberComponent } from './member.component';
import { AddressComponent } from '../address/address.component';
import { VicinityComponent } from '../vicinity/vicinity.component';

const routes: Routes = [
  {
    path: 'home', component: MemberComponent,
  },
  { path: 'address', component: AddressComponent },
  { path: 'vicinity/:idAddress', component: VicinityComponent },
  { path: '**', redirectTo: 'home', pathMatch: 'full' },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class MemberRoutingModule { }
