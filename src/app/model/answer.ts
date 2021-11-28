const keyId = 'id';
const keyUser = 'user';
const keyLookingFor = 'lookingFor';
const keyText = 'text';
const keyWasShown = 'wasShown';
const keyWasRead = 'wasRead';
const keyContact = 'contacts';
const keyUserName = 'userName';
const keyCreationDate = 'creationDate';

export class Answer {
    public static fromJson(json: object): Answer {
        return new Answer(
            json[keyId],
            json[keyUser],
            json[keyLookingFor],
            json[keyCreationDate],
            json[keyText],
            json[keyWasShown],
            json[keyWasRead],
            json[keyContact],
            json[keyUserName]
        );
    }

    constructor(public id: string,
                public user: string, // IRI du user propriétaire
                public lookingFor: string, // IRI du lookingFor propriétaire
                public creationDate: string,
                public text: string = null,
                public wasShown: boolean = false, // une réponse ne peut plus être supprimée par son auteur dès lors qu'elle a été montrée au destinataire
                public wasRead: boolean = false, // marquée comme lue par son destinataire
                public contacts: string = null,
                public userName: string = null // nom du user propriétaire
                ) {
    }
}
