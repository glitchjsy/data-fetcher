import log from "../log";
import mysql from "../mysql";
import redis from "../redis";
import Task from "./Task";

interface ParkingSpacesWrapper {
    carparks: ParkingSpaces[];
    timestamp: Date;
}

interface ParkingSpaces {
    name?: string; // Not included in database, used for logging purposes only
    code: string;
    spaces: number;
    status: string;
    open: boolean
}

const DATA_URL = "http://sojpublicdata.blob.core.windows.net/sojpublicdata/carpark-data.json";

export default class FetchParkingSpacesTask extends Task {
    constructor() {
        super("Fetch Parking Spaces");
    }

    protected async fetchData(): Promise<any> {
        log.debug(this.name, `Fetching from ${DATA_URL}`);
        return this.fetchJson(DATA_URL);
    }

    protected validateData(data: any): any {
        if (!data?.carparkData?.Jersey?.carpark) {
            throw new Error("Invalid response structure: missing carpark data");
        }
        if (!Array.isArray(data.carparkData.Jersey.carpark)) {
            throw new Error("Expected 'carpark' to be an array");
        }
        if (!data.carparkData.Timestamp) {
            throw new Error("Missing Timestamp field");
        }
        return data;
    }

    protected transformData(data: any): ParkingSpacesWrapper {
        const carparks: ParkingSpaces[] = data.carparkData.Jersey.carpark.map((carpark: any) => ({
            name: carpark.name,
            code: carpark.code,
            spaces: carpark.spaces,
            status: carpark.status,
            open: carpark.carparkOpen
        }));

        return {
            carparks,
            timestamp: this.parseTimestamp(data.carparkData.Timestamp)
        };
    }

    protected async persistData(data: ParkingSpacesWrapper): Promise<void> {
        await redis.setAsync("data-livespaces:json", JSON.stringify({
            results: data.carparks,
            timestamp: data.timestamp
        }));

        for (const carpark of data.carparks) {
            await mysql.execute("INSERT INTO liveParkingSpaces (createdAt,name,code,spaces,status,open) VALUES (?,?,?,?,?,?)", [
                data.timestamp,
                carpark.name,
                carpark.code,
                carpark.spaces,
                carpark.status,
                carpark.open
            ]);
        }
    }

    protected async afterExecute(data: ParkingSpacesWrapper): Promise<void> {
        log.info(this.name, `Successfully processed ${data.carparks.length} car parks`);
    }

    private parseTimestamp(timestamp: string): Date {
        const months = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ];

        const parts = timestamp.split(" ");
        const time = parts[5];
        const date = parts[8];
        const month = months.indexOf(parts[9]) + 1;

        const displayMonth = month < 10 ? `0${month}` : `${month}`;
        const displayDate = parseInt(date) < 10 ? `0${date}` : date;

        return new Date(`${new Date().getFullYear()}-${displayMonth}-${displayDate}T${time}Z`);
    }
}
