import nodeFetch, { Response } from "node-fetch";
import log from "../log";
import { ParkingSpaces, ParkingSpacesWrapper } from "../models/data/ParkingSpaces";
import { GovParkingSpacesWrapper } from "../models/gov/GovParkingSpaces";
import Task from "./Task";

const DATA_URL = "http://sojpublicdata.blob.core.windows.net/sojpublicdata/carpark-data.json";

class FetchParkingSpacesTask extends Task<ParkingSpacesWrapper> {

    constructor() {
        super("Fetch Parking Spaces");
    }

    public async execute(): Promise<ParkingSpacesWrapper> {

        const transform = (data: GovParkingSpacesWrapper): ParkingSpacesWrapper => {
            const Jersey = data.carparkData.Jersey;
            const carparks: ParkingSpaces[] = [];

            Jersey.carpark.forEach(carpark => {
                carparks.push({
                    name: carpark.name,
                    code: carpark.code,
                    spaces: carpark.spaces,
                    status: carpark.status,
                    open: carpark.carparkOpen
                });
            });

            return {
                carparks,
                timestamp: parseTimestamp(data.carparkData.Timestamp)
            }
        }

        log.debug("Fetching parking spaces...");

        return nodeFetch(DATA_URL)
            .then(validateResponse)
            .then(transform);
    }

    public async validateResponse(response: Response): Promise<any> {
        if (response.status !== 200) {
            throw new Error(`Received unexpected status code (${response.status})`);
        }
        const json = await response.json();

        return json;
    }

    public parseTimestamp(timestamp: string) {
        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September",
            "October", "November", "December"];

        const parts = timestamp.split(" ");

        const time = parts[5];
        const date = parts[8];
        const month = months.indexOf(parts[9]) + 1;

        const displayMonth = month < 10 ? "0" + month : month;

        return new Date(`${new Date().getFullYear()}-${displayMonth}-${date}:${time}`);
    }
}

const task = new FetchParkingSpacesTask();

const validateResponse = task.validateResponse;
const parseTimestamp = task.parseTimestamp;

export const fetchParkingSpaces = task.execute;