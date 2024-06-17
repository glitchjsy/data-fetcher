// http://sojpublicdata.blob.core.windows.net/sojpublicdata/carpark-data.json

export interface GovParkingSpacesWrapper {
    carparkData: {
        Jersey: {
            carpark: GovParkingSpaces[];
        },
        Timestamp: string;
    }
}

export interface GovParkingSpaces {
    name: string;
    code: string;
    spaces: number;
    type: GovLiveCarparkType;
    status: GovLiveCarparkStatus;
    carparkOpen: boolean;
    carparkInformation: string;
    numberOfUnusableSpaces: number;
    numberOfSpacesConsideredLow: number;
}

export type GovLiveCarparkStatus = "good" | "low" | string;
export type GovLiveCarparkType = "Long stay" | "Short stay" | string;