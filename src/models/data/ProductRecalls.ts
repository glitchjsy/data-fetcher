export interface ProductRecallsWrapper {
    recalls: ProductRecall[];
}

export interface ProductRecall {
    id: number;
    title: string;
    imageUrl: string | null;
    brand: string;
    recallDate: Date;
    packSize: string | null;
    batchCodes: string | null;
    problem: string;
    furtherInformation: string;
    websiteUrl: string | null;
}