import { Answer } from './answer';

const keyId = 'id';
const keyAddress = 'address';
const keyText = 'text';
const keyActive = 'active';
const keyContact = 'contacts';
const keyUserId = 'userId';
const keyUserName = 'userName';
const keyUserCity = 'userCity';
const keyCreationDate = 'creationDate';
const keyUserUnwanted = 'isUserUnwanted';
const keyUserAnswer = 'currentUserAnswer';
const keyEmptyAnswers = 'emptyAnswers';

export class LookingFor {
    public static fromJson(json: object): LookingFor {
        return new LookingFor(
            json[keyId],
            json[keyAddress],
            json[keyCreationDate],
            json[keyText],
            json[keyActive],
            json[keyContact],
            json[keyUserId],
            json[keyUserName],
            json[keyUserCity],
            json[keyUserUnwanted],
            json[keyUserAnswer] ? Answer.fromJson(json[keyUserAnswer]) : null,
            json[keyEmptyAnswers]
        );
    }

    constructor(public id: string,
                public address: string, // IRI de l'adresse propriétaire
                public creationDate: string,
                public text: string = null,
                public active: boolean = true,
                public contacts: string = null,
                public userId: string = null, // id du user propriétaire
                public userName: string = null, // nom du user propriétaire
                public userCity: string = null, // ville du user propriétaire
                public isUserUnwanted: boolean = false,
                public answer: Answer = null,
                public emptyAnswers: boolean = true
                ) {
    }
}
