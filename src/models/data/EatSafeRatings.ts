export interface EatSafeRating {
    name: string;
    rating: number;
    createdAt: string;
    postCode: string | null;
    address1: string | null;
    address2: string | null;
    address3: string | null;
    latitude: number | null;
    longitude: number | null;
}