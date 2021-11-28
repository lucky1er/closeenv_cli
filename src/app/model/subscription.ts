const keyId = 'id';
const keyOrderNumber = 'orderNumber';
const keyStartingDate = 'startingDate';
const keyEndingDate = 'endingDate';
const keyPaymentValidated = 'paymentValidated';
const keyOffer = 'subscriptionOffer';
const keyOfferLabel = 'label';
const keyOfferPrice = 'priceInEuros';
const keyOfferDuration = 'durationInMonths';
const keyNumberDaysLeft = 'numberDaysLeft';
const keyMonthsDuration = 'monthsDuration';
const keyType = 'subscriptionType';
export const offerTypes = ['individual', 'merchant'];

export class Subscription {
    public static fromJson(json: object): Subscription {
        return new Subscription(
            json[keyId],
            json[keyOrderNumber],
            json[keyStartingDate],
            json[keyEndingDate],
            json[keyPaymentValidated],
            json[keyOffer][keyOfferLabel],
            json[keyOffer][keyOfferPrice],
            json[keyOffer][keyOfferDuration],
            json[keyNumberDaysLeft],
            json[keyMonthsDuration],
            json[keyType]
        );
    }

    constructor(public id: string,
                public orderNumber: string,
                public startingDate: string,
                public endingDate: string,
                public paymentValidated: boolean,
                public offerLabel: any = '',
                public offerPrice: number = 0,
                public offerDuration: number = 0,
                public numberDaysLeft: number = 0,
                public monthsDuration: number = 0,
                public type: string = '',
                public offer: any = {}
                ) {
    }
}

