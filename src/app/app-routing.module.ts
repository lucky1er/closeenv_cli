import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { HomeComponent } from './modules/general/home/home.component';
import { NotFoundComponent } from './modules/general/not-found/not-found.component';
import { RelocateComponent } from './modules/general/relocate/relocate.component';
import { PrivacyPolicyComponent } from './modules/general/privacy-policy/privacy-policy.component';
import { AssociationComponent } from './modules/general/association/association.component';

import { AuthGuard } from './modules/general/auth.guard';

const routes: Routes = [
  { path: '', component: HomeComponent, },
  { path: 'home',   redirectTo: '/', pathMatch: 'full' },
  { path: 'relocate', component: RelocateComponent, },
  {
    path: 'about',
    loadChildren: () => import('./modules/general/about/about.module')
      .then(mod => mod.AboutModule)
  },
  {
    path: 'association', component: AssociationComponent
  },
  {
    path: 'contact',
    loadChildren: () => import('./modules/general/contact/contact.module')
      .then(mod => mod.ContactModule)
  },
  { path: 'privacy', component: PrivacyPolicyComponent, },
  {
    path: 'signin',
    loadChildren: () => import('./modules/general/signin/signin.module')
      .then(mod => mod.SigninModule)
  },
  {
    path: 'signup',
    loadChildren: () => import('./modules/general/signup/signup.module')
      .then(mod => mod.SignupModule)
  },
  {
    path: 'password/:token',
    loadChildren: () => import('./modules/general/password/password.module')
      .then(mod => mod.PasswordModule)
  },
  {
    path: 'member',
    loadChildren: () => import('./modules/application/member/member.module')
      .then(mod => mod.MemberModule),
    canActivate: [AuthGuard],
  },
  {
    path: 'ownership/:token',
    loadChildren: () => import('./modules/application/ownership/ownership.module')
      .then(mod => mod.OwnershipModule),
    canActivate: [AuthGuard],
  },
  {
    path: 'admin/stats',
    loadChildren: () => import('./modules/application/admin/chartjs/chartjs.module')
      .then(mod => mod.ChartjsModule)
  },
  {
    path: 'admin/report',
    loadChildren: () => import('./modules/application/admin/report/admin-report.module')
      .then(mod => mod.AdminReportModule)
  },
  { path: '**', component: NotFoundComponent },
];


@NgModule({
  imports: [RouterModule.forRoot(routes, {
    initialNavigation: 'enabled',
    enableTracing: false,
    relativeLinkResolution: 'legacy'
})],
  exports: [RouterModule],
  declarations: []
})
export class AppRoutingModule { }
