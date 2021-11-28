export const environment = {
  production: true,
  appVersion: require('../../package.json').version,
  apiLocal: false,
  apiBaseUrl: 'https://api.close-env.com', // apiEndpoint pour domaine PROD
  apiCommonWay: '/api/',
  apiHeerUrl: 'https://node.close-env.com/away/api/',
  heerApiSpecs: 'v1/discover?q=shop&_ontology=shop&in=circle',
  heerApiCategSpec: 'v1/discover?in=circle',
  heerApiRadius: 9000,
  heerApiLimit: 30,
  urlHeerAccessToken: 'https://node.close-env.com/away/token',
  toleranceMargin: 5000,
  geoapifykey: '8094c30a51656dfd5699435d47aba475e'
};
