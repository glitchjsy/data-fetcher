import nodeFetch, { Response } from "node-fetch";
import MapboxClient from "@mapbox/mapbox-sdk/services/geocoding";
import log from "../log";
import { EatSafeRating } from "../models/data/EatSafeRatings";
import { GovEatSafeRating } from "../models/gov/GovEatSafeRatings";
import Task from "./Task";
import config from "../../config.json";
import crypto from "crypto";
import redis from "../redis";

const geocodingClient = MapboxClient({ accessToken: config.mapboxToken });
const DATA_URL = "https://sojopendata.azurewebsites.net/eatsafe/json";
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

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

                const address = `${rating.address1}, ${rating.address2 ?? ""} ${rating.address3 ? `,${rating.address3}` : ""}, Jersey`.trim();
                const hash = crypto.createHash("sha256").update(address).digest("hex");
                const redisKey = `data-eatsafe-coords:${hash}`;

                try {
                    const cached = await redis.getAsync(redisKey);

                    if (cached) {
                        const parsed = JSON.parse(cached);

                        // TODO: Make it auto expire
                        if (
                            parsed.latitude &&
                            parsed.longitude &&
                            parsed.fetchedAt &&
                            (Date.now() - parsed.fetchedAt) < TWO_WEEKS_MS
                        ) {
                            rating.latitude = parsed.latitude;
                            rating.longitude = parsed.longitude;

                            log.debug(`Using cached coordinates for ${rating.name} (${++i}/${data.length})`);
                            continue;
                        }
                    }

                    // fetch new coords
                    const response = await geocodingClient.forwardGeocode({
                        query: address,
                        limit: 1
                    }).send();

                    if (response?.body?.features?.length > 0) {
                        const { center } = response.body.features[0];

                        rating.latitude = center[1];
                        rating.longitude = center[0];

                        log.debug(`Fetched new coordinates for ${rating.name} (${++i}/${data.length})`);

                        await redis.setAsync(redisKey, JSON.stringify({
                            latitude: rating.latitude,
                            longitude: rating.longitude,
                            fetchedAt: Date.now()
                        }));
                    }
                } catch (e: any) {
                    log.error(`Failed to fetch coordinates for ${rating.name}: ${e.message}`);
                    continue;
                }
            }

            return data;
        }

        log.debug("Fetching eatsafe ratings...");

        return nodeFetch(DATA_URL)
            .then(validateResponse)
            .then(transform)
            .then(fetchCoordinates);
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