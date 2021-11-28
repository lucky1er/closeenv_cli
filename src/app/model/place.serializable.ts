import { JsonProperty } from '@peerlancers/json-serialization';
import { Place } from './place';

const keyAccessValue = 'value';

export class PlaceSerializable {
    @JsonProperty()
    public id: string = undefined;

    @JsonProperty()
    public title: string = undefined;

    @JsonProperty()
    public resultType: string = undefined;

    @JsonProperty()
    public address: string = undefined;

    @JsonProperty()
    public positionLat: number = undefined;

    @JsonProperty()
    public positionLng: number = undefined;

    @JsonProperty()
    public accessLat: number = undefined;

    @JsonProperty()
    public accessLng: number = undefined;

    @JsonProperty()
    public distance: number = undefined;

    @JsonProperty()
    public categories: any[] = undefined;

    @JsonProperty()
    public contacts: any[] = undefined;

    constructor(private place: Place) {
        this.title = place.title;
        this.resultType = place.resultType;
        this.address = place.address;
        this.positionLat = place.positionLat;
        this.positionLng = place.positionLng;
        this.accessLat = place.accessLat;
        this.accessLng = place.accessLng;
        this.distance = place.distance;
        // Array categories
        if (typeof place.categories !== 'undefined' && place.categories.length) {
            this.categories = [];
            for (const categ of place.categories) {
                this.categories.push(categ);
            }
        }
        // Array contacts  ( example: [{phone:[{value:"+330244332211"},{value:"+330644332211"}],email:[{value:""toto@free.fr}]}] )
        this.contacts = PlaceSerializable.flatArrayContacts(place.contacts);
    }

    public static flatArrayContacts(complexContacts: any): string[] {
        const arrayContacts = [];
        if (typeof complexContacts !== 'undefined' && complexContacts.length) {
            for (const contact1 of complexContacts) {
                if (typeof contact1 === 'object') {
                    for (const key in contact1) {
                        if (contact1.hasOwnProperty(key) && (key === 'phone' || key === 'email' || key === 'www')) {
                            for (const contactDetail of contact1[key]) {
                                if (typeof contactDetail === 'object' && contactDetail.hasOwnProperty(keyAccessValue)
                                 && typeof contactDetail[keyAccessValue] === 'string' && contactDetail[keyAccessValue] !== '') {
                                    arrayContacts.push(contactDetail[keyAccessValue]);
                                }
                            }
                        }
                    }
                }
            }
        }

        return arrayContacts;
    }
}
