import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BrowserService } from '../service/browser.service';
import { AddOnTranslationService } from '../service/addOn.translation.service';
import { MapComponentService } from '../map/map.component.service';
import { Router } from '@angular/router';
import { AuthService } from '../service/auth.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
})
export class HomeComponent implements OnInit {

  public showMap = false;

  constructor(
    private router: Router,
    public authService: AuthService,
    private browserService: BrowserService,
    private mapComponentService: MapComponentService,
    private addonTranslator: AddOnTranslationService,
    @Inject(PLATFORM_ID) private platformId: object) {
  }

  ngOnInit(): void {
    this.addonTranslator.checkMetaTagInit();
    this.addonTranslator.checkRouteParamLang();

    if (isPlatformBrowser(this.platformId) && this.authService.isTokenRecovered()) {
      this.router.navigate(['member']);
    } else {
      // vérifier si on connait une localisation pour la map
      const userCoords = this.browserService.getLocalStorageItem('position');
      const aroundUser = this.browserService.getLocalStorageSerializable('nearby');
      // console.log('HomeComponent, OnInit > userCoords ', userCoords, aroundUser);
      if (userCoords === null) {
        // localisation pas encore connue => afficher message de bienvenue à la place de la map
      } else {
        if (this.mapComponentService.getMapOptions() === null) {
          this.mapComponentService.resetMapOptions(userCoords, aroundUser); // dès lors, la map peut être affichée
        }
        this.showMap = true;
      }
    }
  }
}
