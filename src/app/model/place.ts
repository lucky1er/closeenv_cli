import { PlaceSerializable } from './place.serializable';

const keyId = 'id';
const keyTitle = 'title';
const keyResultType = 'resultType';
const keyAddress = 'address';
const keyAddressLabel = 'label';
const keyPosition = 'position';
const keyPositionLat = 'lat';
const keyPositionLng = 'lng';
const keyAccess = 'position';
const keyAccessLat = 'lat';
const keyAccessLng = 'lng';
const keyDistance = 'distance';
const keyCategories = 'categories';
const keyCategorieId = 'id';
const keyContacts = 'contacts';
const keyBaseLatitude = 'latitude';
const keyBaseLongitude = 'longitude';
const keyUserInitiative = 'userInitiative';
const keyOrderInList = 'orderInList';
const keyFlags = 'flags';
const keyLogicalRemoval = 'logicalRemoval';
const keyRemovalReason = 'removalReason';
const keyPopupMessage = 'popupMessage';
const keyValidEmail = 'validEmail';
const keyMerchantRegistered = 'isMerchantRegistered';
const separatorTitleAddress = ', ';
export const keyFromSpecificSearch = 'from-specific-search';
export const placeDefaultOrder = 99;
export const tempIdPrefix = 'user';
export const assoCategoryCode = '000-0000-0000';

function getStringWithoutPrefix(theString: string, prefix: string): string {
    if (theString.startsWith(prefix)) {
      return theString.substring(prefix.length).trim();
    } else {
      return theString;
    }
}

export class Place {
    public static fromJson(json: object): Place {
        const titlePrefix = json[keyTitle] + separatorTitleAddress;
        return new Place(
            json[keyId],
            json[keyTitle],
            json[keyResultType],
            getStringWithoutPrefix(json[keyAddress][keyAddressLabel], titlePrefix),
            json[keyPosition][keyPositionLat],
            json[keyPosition][keyPositionLng],
            json[keyAccess][keyAccessLat],
            json[keyAccess][keyAccessLng],
            json[keyDistance],
            json[keyCategories] ? json[keyCategories].map(categ => categ[keyCategorieId]) : [],
            PlaceSerializable.flatArrayContacts(json[keyContacts]),
            false,
            placeDefaultOrder
        );
    }

    public static fromJsonBase(jsonBase: object): Place {
        /* mapping for json from api base */
        return new Place(
            jsonBase[keyId],
            jsonBase[keyTitle],
            '',
            jsonBase[keyAddress],
            jsonBase[keyBaseLatitude],
            jsonBase[keyBaseLongitude],
            null,
            null,
            jsonBase[keyDistance],
            jsonBase[keyCategories],
            jsonBase[keyContacts],
            jsonBase[keyUserInitiative],
            jsonBase[keyOrderInList],
            jsonBase[keyFlags],
            jsonBase[keyLogicalRemoval],
            jsonBase[keyRemovalReason],
            jsonBase[keyValidEmail],
            jsonBase[keyMerchantRegistered],
            jsonBase[keyPopupMessage]
        );
    }

    constructor(public id: string,
                public title: string,
                public resultType: string,
                public address: string,
                public positionLat: number,
                public positionLng: number,
                public accessLat: number,
                public accessLng: number,
                public distance: number,
                public categories: any[],
                public contacts: any[],
                public userInitiative: boolean = false,
                public orderInList: number = 0,
                public flags: any[] = [],
                public logicalRemoval: boolean = false,
                public removalReason: number = 0,
                public hasValidEmail: boolean = false,
                public merchantRegistered: boolean = false,
                public popupMessage: string = null,
                public asso: any = null
                ) {
    }

    public static sortByOrderDistance(a: Place, b: Place) {
        if (a.orderInList === b.orderInList) {
          return a.distance - b.distance;
        } else {
          return a.orderInList - b.orderInList;
        }
    }

    public static getAddressWithoutTitlePrefix(thePlace: Place): string {
        return getStringWithoutPrefix(thePlace.address, thePlace.title + separatorTitleAddress);
    }

    public static replaceHyphenBySpace(astring: string): string {
      return astring.replace(/-/g, ' ');
    }

    public static removeDots(astring: string): string {
      return astring.replace(/\./g,'');
    }

    public static replaceAccents(astring: string): string {
      var regAccentA = new RegExp('[àâä]', 'gi');
      var regAccentE = new RegExp('[éèêë]', 'gi');

      return astring.replace(regAccentA, 'a').replace(regAccentE, 'e');
    }

    public static normalizedStringsEquivalence(stringOne: string, stringTwo: string): boolean {
      const normalizedStringOne = Place.replaceHyphenBySpace(Place.replaceAccents(stringOne).toUpperCase());
      const normalizedStringTwo = Place.replaceHyphenBySpace(Place.replaceAccents(stringTwo).toUpperCase());
      const canMatch = normalizedStringOne.indexOf(normalizedStringTwo) !== -1
        || (normalizedStringTwo.indexOf(normalizedStringOne) !== -1 && normalizedStringTwo.indexOf(normalizedStringOne) < 10);
      return canMatch;
    }

    public static normalizedStringsEquality(stringOne: string, stringTwo: string): boolean {
      const normalizedStringOne = Place.removeDots(Place.replaceHyphenBySpace(Place.replaceAccents(stringOne.trim()).toUpperCase()));
      const normalizedStringTwo = Place.removeDots(Place.replaceHyphenBySpace(Place.replaceAccents(stringTwo.trim()).toUpperCase()));
      return (normalizedStringOne === normalizedStringTwo);
    }

    public static isAssociation(thePlace: Place): boolean {
      return thePlace.categories && thePlace.categories.length === 1 && thePlace.categories[0] === assoCategoryCode;
    }
  
}
