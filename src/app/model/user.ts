const keyIri = '@id';
const keyEmail = 'email';
const keyPassword = 'password';
const keyToken = 'token';
const keyFirstName = 'firstName';
const keyLastName = 'lastName';
const keyAddress = 'address';
const keyAddress1 = 'address1';
const keyAddressId = 'idAddress1';
const keyLatitude = 'latitude';
const keyLongitude = 'longitude';
const keyCountry = 'country';
const keyCity = 'city';
const keyPostcode = 'postCode';
const keyCounty = 'county';
const keyAdministrative = 'administrative';
const keyCountryCode = 'countryCode';
const keyLanguageCode = 'lgCode';
const keyIdCurrentSubscrip = 'idCurrentSubscription';
const keyIdLatestSubscrip = 'idLatestSubscription';
const keyEmailFromMerchant = 'emailFromMerchant';
const keyEmailFromAsso = 'emailFromAsso';
const keyEmailSiteNews = 'emailSiteNews';
const keyAdmin = 'admin';
const keyNumberDaysSinceCreation = 'numberDaysSinceCreation';

export class User {
    iri: string;
    email: string;
    password: string;
    token: string;
    firstName: string;
    lastName: string;
    address: string;
    addressId: string;
    country: string;
    city: string;
    postCode: string;
    county: string;
    administrative: string;
    countryCode: string;
    languageCode: string;
    idCurrentSubscription: string;
    idLatestSubscription: string;
    latitude: number; // optional latitude for 1st address initialization (signup)
    longitude: number; // optional longitude for 1st address initialization (signup)
    merchantSubscriber: boolean;
    emailFromMerchant: boolean;
    emailFromAsso: boolean;
    emailSiteNews: boolean;
    admin: boolean;
    numberDaysSinceCreation: number;

    public static populateFromJson(json: object): User {
        const newUser = new User();
        newUser.email = json[keyEmail]; // info minimale requise

        if (typeof json[keyPassword] !== 'undefined') {
            newUser.password = json[keyPassword];
        }
        if (typeof json[keyIri] !== 'undefined') {
            newUser.iri = json[keyIri];
        }
        if (typeof json[keyToken] !== 'undefined') {
            newUser.token = json[keyToken];
        }
        if (typeof json[keyFirstName] !== 'undefined') {
            newUser.firstName = json[keyFirstName];
        }
        if (typeof json[keyLastName] !== 'undefined') {
            newUser.lastName = json[keyLastName];
        }
        if (typeof json[keyAddress] !== 'undefined') {
            newUser.address = json[keyAddress];
        }
        if (typeof json[keyAddress1] !== 'undefined') {
            newUser.address = json[keyAddress1];
        }
        if (typeof json[keyAddressId] !== 'undefined') {
            newUser.addressId = json[keyAddressId];
        }
        if (typeof json[keyCountry] !== 'undefined') {
            newUser.country = json[keyCountry];
        }
        if (typeof json[keyCity] !== 'undefined') {
            newUser.city = json[keyCity];
        }
        if (typeof json[keyPostcode] !== 'undefined') {
            newUser.postCode = json[keyPostcode];
        }
        if (typeof json[keyCounty] !== 'undefined') {
            newUser.county = json[keyCounty];
        }
        if (typeof json[keyAdministrative] !== 'undefined') {
            newUser.administrative = json[keyAdministrative];
        }
        if (typeof json[keyCountryCode] !== 'undefined') {
            newUser.countryCode = json[keyCountryCode];
        }
        if (typeof json[keyLatitude] !== 'undefined') {
            newUser.latitude = json[keyLatitude];
        }
        if (typeof json[keyLongitude] !== 'undefined') {
            newUser.longitude = json[keyLongitude];
        }
        if (typeof json[keyLanguageCode] !== 'undefined') {
            newUser.languageCode = json[keyLanguageCode];
        }
        if (typeof json[keyIdCurrentSubscrip] !== 'undefined') {
            newUser.idCurrentSubscription = json[keyIdCurrentSubscrip];
        }
        if (typeof json[keyIdLatestSubscrip] !== 'undefined') {
            newUser.idLatestSubscription = json[keyIdLatestSubscrip];
        }
        if (typeof json[keyEmailFromMerchant] !== 'undefined') {
            newUser.emailFromMerchant = json[keyEmailFromMerchant];
        }
        if (typeof json[keyEmailFromAsso] !== 'undefined') {
            newUser.emailFromAsso = json[keyEmailFromAsso];
        }
        if (typeof json[keyEmailSiteNews] !== 'undefined') {
            newUser.emailSiteNews = json[keyEmailSiteNews];
        }
        newUser.merchantSubscriber = false;
        newUser.admin = false;
        if (typeof json[keyAdmin] !== 'undefined') {
            newUser.admin = json[keyAdmin];
        }
        newUser.numberDaysSinceCreation = 999;
        if (typeof json[keyNumberDaysSinceCreation] !== 'undefined') {
            newUser.numberDaysSinceCreation = json[keyNumberDaysSinceCreation];
        }

        return newUser;
    }
}
