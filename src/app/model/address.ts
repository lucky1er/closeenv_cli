import { Place } from './place';

const keyId = 'id';
const keyUser = 'user';
const keyLabel = 'addressLabel';
const keyCountry = 'country';
const keyCity = 'city';
const keyPostCode = 'postCode';
const keyCounty = 'county';
const keyAdministrative = 'administrative';
const keyLatitude = 'latitude';
const keyLongitude = 'longitude';
const keyCountryCode = 'countryCode';
const keyNumberOfPlaces = 'numberOfPlaces';
const keyShop = 'shop';
const keyShopValidated = 'shopValidated';
const keyPlaceCategories = 'placeCategories';
const keyLookingForItemsCount = 'numberOfLookingFors';

export class Address {
    public static fromJson(json: object): Address {
        return new Address(
            json[keyId],
            json[keyUser],
            json[keyLabel],
            json[keyCountry],
            json[keyCity],
            json[keyPostCode],
            json[keyCounty],
            json[keyAdministrative],
            json[keyLatitude],
            json[keyLongitude],
            json[keyCountryCode],
            json[keyNumberOfPlaces] ? json[keyNumberOfPlaces] : null,
            json[keyShop],
            json[keyShopValidated],
            json[keyPlaceCategories],
            json[keyLookingForItemsCount]
        );
    }

    constructor(public id: number,
                public user: string, // IRI du user
                public addressLabel: string,
                public country: string,
                public city: string,
                public postCode: string,
                public county: string = '',
                public administrative: string = '',
                public latitude: string = null,
                public longitude: string = null,
                public countryCode: string = '',
                public nbLinkedPlaces: number = null,
                public shop: string = null, // IRI du shop
                public shopValidated: boolean = false,
                public placeCategories: string[] = [],
                public lfiCount: number = 0, // nombre d'items LookingFor
                public nbUsersAround: number = 0,
                public msgsCount: number = 0
                ) {
    }

    public static getStandardizedAddressString(theAddress: Address): string {
        let stdAddress = theAddress.addressLabel.trim() + ', ';
        if (theAddress.postCode && theAddress.postCode.trim() !== '') {
          stdAddress += theAddress.postCode.trim() + ' ';
        }
        if (theAddress.city && theAddress.city.trim() !== '') {
          stdAddress += theAddress.city.trim() + ', ';
        }
        if (theAddress.country && theAddress.country.trim() !== '') {
          stdAddress += theAddress.country.trim();
        }

        return stdAddress;
    }
}
