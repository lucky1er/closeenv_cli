const keyId = 'id';
const keyShop = 'shop';
const keyAsso = 'asso';
const keyLanguageCode = 'languageCode';
const keyLabel = 'label';
const keyText = 'text';
const keyValidFrom = 'validFrom';
const keyValidTo = 'validTo';
const keyNumberOfRecipients = 'numberOfRecipients';
const keyToBeSent = 'toBeSent';
const keyLockedForSending = 'lockedForSending';
const keyUnlocked = 'unlocked';
const keyMailingDate = 'mailingDate';
const keyGuiViewsCounter = 'guiViewsCounter';

export class ShopMessage {
    public static fromJson(json: object): ShopMessage {
        return new ShopMessage(
            json[keyId],
            json[keyShop] ? json[keyShop] : null,
            json[keyAsso] ? json[keyAsso] : null,
            json[keyLanguageCode],
            json[keyLabel],
            json[keyText],
            json[keyValidFrom],
            json[keyValidTo],
            json[keyNumberOfRecipients] ? json[keyNumberOfRecipients] : null,
            json[keyToBeSent],
            json[keyLockedForSending],
            json[keyUnlocked],
            json[keyMailingDate],
            json[keyGuiViewsCounter]
        );
    }

    constructor(public id: string,
                public shop: string, // IRI de la Place représentant le commerce
                public asso: string, // IRI de la Place représentant l'association
                public languageCode: string, // code langue du Message
                public label: string, // libellé du message
                public text: string = null, // texte (corps) du Message
                public validFrom: string = null, // date début de validité
                public validTo: string = null, // date fin de validité
                public numberOfRecipients: number = null, // nombre de destinataires effectifs (mailing)
                public toBeSent: boolean = true, // Le message est-il destiné à être envoyé comme email ?
                public lockedForSending: boolean = false, // Le message est-il verrouillé pour diffusion mailing (non modifiable) ?
                public unlocked: boolean = false, // Le message est-il déverrouillé suite à problème pendant le traitement de mailing ?
                public mailingDate: string = '', // Date/heure du traitement de mailing
                public guiViewsCounter: number = 0 // compteur de vues sur ihm client
                ) {
    }

}
