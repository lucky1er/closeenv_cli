import { Component, OnInit, Inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { AddOnTranslationService } from './modules/general/service/addOn.translation.service';
import { ApiHttpService } from './modules/general/service/api.http.service';
import { AuthService } from './modules/general/service/auth.service';
import { environment } from '../environments/environment';

const prodBrand = 'close-env.';
const candBrand = '[test] close-env.';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  providers: [ AuthService ]
})
export class AppComponent implements OnInit {
  appBrand = prodBrand;
  appVersion = environment.appVersion;
  actualCoords: any;
  underMaintenance: boolean;

  constructor(
    public addonTranslator: AddOnTranslationService,
    public apiHttpService: ApiHttpService,
    public authService: AuthService,
    @Inject(DOCUMENT) private document: Document,
    private router: Router
    ) {
    this.underMaintenance = false;
    router.events.subscribe((val: NavigationEnd) => {
      if (typeof val.url === 'string') {
        authService.checkActiveRoute(val.url);
      }
    });
  }

  public ngOnInit(): void {
    if (this.appVersion.indexOf('-RC') !== -1) {
      this.appBrand = candBrand; // Release Candidat (pre-prod)
    }

    this.addonTranslator.checkLangToInitiate();

    if (this.authService.isUserAdmin()) {
      this.checkMaintenance();
    }
  }

  changeLanguage(changeEvent) {
    const newValue = changeEvent.target.value;
    this.addonTranslator.changeLangForTranslation(newValue, true);
  }

  checkMaintenance() {
    this.apiHttpService.checkMaintenance()
      .subscribe((flag) => {
        this.underMaintenance = flag;
      }, (error) => {
        console.warn('[API] checkMaintenance() returns error ', error);
      });
  }

  toggleMaintenance() {
    if (!this.authService.isUserAdmin()) {
      return false;
    }
    this.apiHttpService.toggleMaintenance()
      .subscribe((flag) => {
        this.underMaintenance = flag;
      }, (error) => {
        console.warn('[API] toggleMaintenance() returns error ', error);
      });
    return true;
  }

  logout() {
    this.authService.removeToken();
    this.document.location.reload();
  }
}
