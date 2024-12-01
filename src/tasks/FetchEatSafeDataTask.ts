import nodeFetch, { Response } from "node-fetch";
import MapboxClient from "@mapbox/mapbox-sdk/services/geocoding";
import log from "../log";
import { EatSafeRating } from "../models/data/EatSafeRatings";
import { GovEatSafeRating } from "../models/gov/GovEatSafeRatings";
import Task from "./Task";

const geocodingClient = MapboxClient({ accessToken: "pk.eyJ1IjoibHVrZWVleWRldiIsImEiOiJjbHI4cjV3MGswYjYzMmp0M3lnaGllcHZhIn0.rBFyu08FWcUHQ2S7YSN0zg" });
const DATA_URL = "https://sojopendata.azurewebsites.net/eatsafe/json";

class FetchEatSafeDataTask extends Task<EatSafeRating[]> {

    constructor() {
        super("Fetch Eat Safe Ratings");
    }

    public async execute(): Promise<EatSafeRating[]> {

        const transform = (data: GovEatSafeRating[]): EatSafeRating[] => {
            const ratings = [] as EatSafeRating[];

            data.forEach(rating => {
                ratings.push({
                    name: rating.Addr1,
                    rating: Number(rating.Rating),
                    createdAt: rating.Completiondate,
                    address1: rating.Addr2 || null,
                    address2: rating.Addr3 || null,
                    address3: rating.Addr4 || null,
                    postCode: rating.Postcd || null,
                    latitude: null,
                    longitude: null
                });
            });

            return ratings;
        }

        const fetchCoordinates = async (data: EatSafeRating[]): Promise<EatSafeRating[]> => {
            let i = 0;

            for (const rating of data) {
                if (!rating.address1) {
                    i++;
                    continue;
                }
                const address = `${rating.address1}, ${rating.address2} ${rating.address3 ? `,${rating.address3}` : ""}, Jersey`;

                try {
                    const response = await geocodingClient.forwardGeocode({
                        query: address,
                        limit: 1
                    }).send();

                    if (response && response.body && response.body.features && response.body.features.length > 0) {
                        const { center } = response.body.features[0];
                        
                        rating.latitude = center[1];
                        rating.longitude = center[0];

                        log.debug(`Fetched coordinates for ${rating.name} (${++i}/${data.length})`)
                    }
                } catch (e: any) {
                    continue;
                }
            }
            return data;
        }

        log.debug("Fetching eatsafe ratings...");

        return nodeFetch(DATA_URL)
            .then(validateResponse)
            .then(transform)
            // .then(fetchCoordinates); - Temporarily disabled until mapbox account issues are sorted
    }


    public async validateResponse(response: Response): Promise<any> {
        if (response.status !== 200) {
            throw new Error(`Received unexpected status code (${response.status})`);
        }
        const json = await response.json();

        return json;
    }
}

const task = new FetchEatSafeDataTask();

const validateResponse = task.validateResponse;

export const fetchEatSafeRatings = task.execute;