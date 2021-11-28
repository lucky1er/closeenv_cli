// This file can be replaced during build by using the `fileReplacements` array.
// `ng build --prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  appVersion: require('../../package.json').version + '-dev',
  apiLocal: false,
  apiBaseUrl: 'http://dev.localhost', // api base endpoint (root)
  apiCommonWay: '/api/',
  apiHeerUrl: 'https://node.close-env.com/away/api/',
  heerApiSpecs: 'v1/discover?q=shop&_ontology=shop&in=circle',
  heerApiCategSpec: 'v1/discover?in=circle',
  heerApiRadius: 9000,
  heerApiLimit: 30,
  urlHeerAccessToken: 'https://node.close-env.com/away/token',
  toleranceMargin: 6000,
  geoapifykey: '8094c30a51656dfd5699435d47aba475e'
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/dist/zone-error';  // Included with Angular CLI.
