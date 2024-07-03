// https://sojopendata.azurewebsites.net/eatsafe/json

export interface GovEatSafeRating {
    Addr1: string; // Business name
    Addr2: string | null;
    Addr3: string | null;
    Addr4: string | null;
    Addr5: string | null;
    Addr6: string | null;
    Completiondate: string;
    Fulladdr: string | null;
    Postcd: string | null; // Postcode
    Rating: string;
    Sttown: string | null; 
    Url: string | null;
}