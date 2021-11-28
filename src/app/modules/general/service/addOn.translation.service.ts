import { Injectable } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { TranslateService, LangChangeEvent } from '@ngx-translate/core';
import { of } from 'rxjs';
import { BrowserService } from './browser.service';

export const appLocaleCodes = {en: 'en-US', fr: 'fr-FR'}; // only 2 locales available in app

// stub pouvant servir aux tests unitaires des composants faisant appel à ce service
export const routeLangParamStub = {
  queryParams: of({
    lang: 'en',
  }),
};

export type CodeLabel = {
  code: string,
  label: string
};

@Injectable({
    providedIn: 'root'
})
export class AddOnTranslationService {

  readonly langCodes = ['en', 'fr']; // cf. appLocaleCodes
  currentLgCode: string = this.langCodes[0];

  constructor(
    private actRoute: ActivatedRoute,
    private meta: Meta,
    private titleService: Title,
    private browserService: BrowserService,
    private translateService: TranslateService) {}

  getTranslationDefaultLang(): string {
    return this.translateService.getDefaultLang();
  }

  getBrowserDefaultLang(): string {
    return this.translateService.getBrowserLang();
  }

  getDeterminedLocale(): string {
    const currentLangCode = this.getTranslationDefaultLang();
    let transLocale = appLocaleCodes.en; // by default

    if (appLocaleCodes.hasOwnProperty(currentLangCode)) {
      transLocale = appLocaleCodes[currentLangCode];
    }

    return transLocale;
  }

  checkLangToInitiate() {
    let memoLocale = '';
    if (this.browserService.getLocalStorageItem('locale')) {
      memoLocale = this.browserService.getLocalStorageItem('locale');
      this.currentLgCode = memoLocale;
    } else {
      this.currentLgCode = this.translateService.getBrowserLang();
    }

    if (this.langCodes.indexOf(this.currentLgCode) < 0) {
      // console.log('lang code not available ', this.currentLgCode);
      this.currentLgCode = this.langCodes[0];
    }

    this.changeLangForTranslation(this.currentLgCode, (memoLocale !== this.currentLgCode));
  }

  changeLangForTranslation(newLangToUse: string, lsUpdate: boolean = false) {
    if (this.langCodes.indexOf(newLangToUse) < 0) {
      return; // lang code not available
    }
    this.translateService.setDefaultLang(newLangToUse);
    this.translateService.use(newLangToUse);
    if (lsUpdate) {
      this.browserService.setLocalStorageItem('locale', newLangToUse);
    }
    if (this.currentLgCode !== newLangToUse) {
      this.currentLgCode = newLangToUse;
    }
  }

  checkRouteParamLang() {
    this.actRoute.queryParams
      .subscribe(params => {
        if (params.hasOwnProperty('lang')) {
          const routeParamLang = params.lang;
          if (typeof routeParamLang === 'string' && routeParamLang !== this.currentLgCode) {
            // console.log('[DEBUG] -2- checkRouteParamLang() -  from -> to ', this.currentLgCode, routeParamLang);
            this.changeLangForTranslation(routeParamLang, true);
          }
        }
      });
  }

  getOriginalTranslation(textObject: any): string {
    const currentLangCode = this.translateService.getDefaultLang();
    let textTranslatedFromSource = '';
    if (textObject.hasOwnProperty(currentLangCode)) {
      textTranslatedFromSource = decodeURI(textObject[currentLangCode]).replace(/''/g, '\'');
    }
    return textTranslatedFromSource;
  }

  mapCodeLabelWithDefaultTranslation(listObjects: any[]): CodeLabel[] {
    return listObjects.map(item => {
      return { code: item.code, label: this.getOriginalTranslation(item.label) };
    });
  }

  instantTranslate(translateKey: string): string {
    return this.translateService.instant(translateKey);
  }

  isMetaDescriptionFound(): boolean {
    const checkMetaDescription = this.meta.getTag('name=\'description\'');
    return (checkMetaDescription !== null);
  }

  checkMetaTagInit(): void {
    if (!this.isMetaDescriptionFound()) {
      // console.log('[DEBUG] meta tag init (checkMetaTagInit) - 0 ');
      this.refreshMeta();

      this.translateService.onLangChange.subscribe((event: LangChangeEvent) => {
        this.refreshMeta();
      });
    }
  }

  refreshMeta(): void {
    const slogan: string = this.translateService.instant('App.slogan');
    const siteContent: string = this.translateService.instant('App.content');
    const description: string = this.translateService.instant('App.description');
    const keywords: string = this.translateService.instant('App.keywords');
    const siteTitle = 'Close-Env : ' + slogan;
    const siteImage = `https://my.close-env.com/assets/params/images/word-cloud_${this.translateService.getDefaultLang()}.png`;

    this.titleService.setTitle(siteTitle);

    this.meta.updateTag({
      name: 'close-env',
      content: siteContent
    });
    this.meta.updateTag({
      name: 'description',
      content: description
    });
    this.meta.updateTag({
      name: 'keywords',
      content: keywords
    });

    // OpenGraph
    this.meta.updateTag({
      property: 'og:title',
      content: siteTitle
    });
    this.meta.updateTag({
      property: 'og:url',
      content: 'https://my.close-env.com'
    });
    this.meta.updateTag({
      property: 'og:image',
      content: siteImage
    });
    this.meta.updateTag({
      property: 'og:description',
      content: description
    });
    this.meta.updateTag({
      property: 'og:type',
      content: 'website'
    });

    // Twitter Card
    this.meta.updateTag({
      name: 'twitter:card',
      content: 'summary'
    });
    this.meta.updateTag({
      property: 'twitter:title',
      content: siteTitle
    });
    this.meta.updateTag({
      property: 'twitter:image',
      content: siteImage
    });
    this.meta.updateTag({
      property: 'twitter:description',
      content: description
    });
  }
}
