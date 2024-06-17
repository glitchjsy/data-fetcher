export interface ParkingSpacesWrapper {
    carparks: ParkingSpaces[];
    timestamp: Date;
}

export interface ParkingSpaces {
    name?: string; // Not included in database, used for logging purposes only
    code: string;
    spaces: number;
    status: string;
    open: boolean
}