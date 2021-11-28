import { Injectable } from '@angular/core';

interface Scripts {
  name: string;
  src: string;
  attrs: any[];
}

const fixCurrencyCode = 'EUR';
const ppClientId = {
  sandbox: 'ARLgDyVrwsGA2GuUc3e-01a5GdY1aIG7599sUBwaBymGgVeb92qUGw_jHXfLiXcmPyBC4R5UGO8_puiS',
  production: 'AUMnYdfZ26umYGux-BmA5N2499SN5v-nKmj91ScdHiVurQ_D76QQkHqZ3mojxGXohX2ljM3NZMbeo-g8'
};
const defEnvKey = 'sandbox';
const prodEnvKey = 'production';

@Injectable({
  providedIn: 'root'
})
export class ExternalScriptService {

  private appEnv: string;
  private scriptStore: Scripts[];
  private scripts: any = {};

  constructor() {
    this.appEnv = defEnvKey;
  }

  private initScriptStore() {
    this.scriptStore = [
      // { name: 'paypal-old', src: 'https://www.paypalobjects.com/api/checkout.js', attrs: ['data-version-4', {'data-log-level':'warn'}] },
      {
        name: 'paypal',
        src: 'https://www.paypal.com/sdk/js?client-id=' + this.paypalCID() + '&currency=' + fixCurrencyCode,
          //  + '&locale=' + ppLocale,
          //  + '&debug=true',
        attrs: []
      },
      // { name: 'pdfMake', src: 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.59/pdfmake.min.js', attrs: [] },
    ];
  }

  paypalCID(): string {
    return ppClientId.hasOwnProperty(this.appEnv) ? ppClientId[this.appEnv] : ppClientId.sandbox;
  }

  initScripts(newAppEnv: string): void {
    if (typeof newAppEnv === 'string' && newAppEnv.startsWith('prod')) {
      this.appEnv = prodEnvKey;
    } else {
      this.appEnv = defEnvKey;
    }
    this.scripts = {};
    this.initScriptStore();

    this.scriptStore.forEach((script: any) => {
      this.scripts[script.name] = {
        loaded: false,
        src: script.src,
        attrs: script.attrs
      };
    });
  }

  load(...scripts: string[]) {
    const promises: any[] = [];
    scripts.forEach((script) => promises.push(this.loadScript(script)));
    return Promise.all(promises);
  }

  loadScript(name: string) {
    return new Promise((resolve, reject) => {
      // resolve if already loaded
      if (this.scripts[name].loaded) {
        resolve({ script: name, loaded: true, status: 'Already Loaded' });
      } else {
        // load script
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = this.scripts[name].src;
        if (this.scripts[name].attrs.length) {
          for (const wrapAttr of this.scripts[name].attrs) {
            let attrKey = wrapAttr;
            let attrValue = '';
            if (typeof wrapAttr === 'object') {
              for (const key in wrapAttr) {
                if (wrapAttr.hasOwnProperty(key)) {
                  attrKey = key;
                  attrValue = wrapAttr[key];
                  break;
                }
              }
            }
            if (typeof attrKey === 'string' && typeof attrValue === 'string') {
              script.setAttribute(attrKey, attrValue);
            }
          }
        }
        script.onload = () => {
          this.scripts[name].loaded = true;
          // console.log(`${name} Loaded.`);
          resolve({ script: name, loaded: true, status: 'Loaded' });
        };
        script.onerror = (error: any) => resolve({ script: name, loaded: false, status: 'Loaded' });
        document.getElementsByTagName('head')[0].appendChild(script);
      }
    });
  }
}