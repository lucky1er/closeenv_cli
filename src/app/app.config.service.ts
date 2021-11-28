import { Injectable } from '@angular/core';
import * as settings from 'src/assets/params/settings.json';

const keyLevelOne = 'default';

type AppConfig = {
  heerApiSpecs: string,
  heerApiRadius: number,
  heerApiLimit: number,
  toleranceMargin: number,
  allowMerchantSubscription: boolean,
  patchUser: boolean
};

@Injectable({
    providedIn: 'root'
})
export class AppConfigService {
  private appConfig: AppConfig;

  constructor() {
    this.appConfig = null;
    for (const key in settings) {
      // console.log('[DEBUG] settings.', key);
      if (key === keyLevelOne) {
        this.appConfig = settings[keyLevelOne];
        break;
      }
    }
    if (!this.appConfig) {
      this.appConfig = settings;
    }
  }

  // public getter
  get config(): AppConfig {
    return this.appConfig;
  }
}
