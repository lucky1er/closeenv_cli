
export type TranslatedText = {
    en: string,
    fr: string
};

export class Category {
    public static fromJson(json: object): Category {
        return new Category(
            json['code'],
            json['label']
        );
    }

    constructor(public code: string, public label: TranslatedText) {}
}
