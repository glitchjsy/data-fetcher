import log from "../log";
import redis from "../redis";
import MapboxClient from "@mapbox/mapbox-sdk/services/geocoding";
import crypto from "crypto";
import config from "../../config.json";
import Task from "./Task";

interface EatSafeRating {
    name: string;
    rating: number;
    createdAt: string;
    postCode: string | null;
    address1: string | null;
    address2: string | null;
    address3: string | null;
    latitude: number | null;
    longitude: number | null;
    hash?: string;
}

const geocodingClient = MapboxClient({ accessToken: config.mapboxToken });
const DATA_URL = "https://sojopendata.azurewebsites.net/eatsafe/json";
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
const RATE_LIMIT = 800; // per minute
const WAIT_MS = 60000 / RATE_LIMIT;

export default class FetchEatSafeDataTask extends Task {
    constructor() {
        super("Fetch Eat Safe Ratings", "eatsafe");
    }

    protected async fetchData(): Promise<any[]> {
        log.debug(this.name, `Fetching from ${DATA_URL}`);
        return this.fetchJson(DATA_URL);
    }

    protected validateData(data: any): any[] {
        if (!Array.isArray(data)) {
            throw new Error("Expected array response from API");
        }
        for (const item of data) {
            if (typeof item.Addr1 !== "string" || typeof item.Rating === "undefined") {
                throw new Error("Invalid response format");
            }
        }
        return data;
    }

    protected transformData(data: any[]): EatSafeRating[] {
        return data.map(rating => ({
            name: rating.Addr1,
            rating: Number(rating.Rating),
            createdAt: rating.Completiondate,
            address1: rating.Addr2 || null,
            address2: rating.Addr3 || null,
            address3: rating.Addr4 || null,
            postCode: rating.Postcd || null,
            latitude: null,
            longitude: null
        }));
    }

    protected async persistData(data: EatSafeRating[]): Promise<void> {
        let i = 0;

        for (const rating of data) {
            if (!rating.address1) {
                i++;
                continue;
            }

            const address = `${rating.address1}, ${rating.address2 ?? ""}${rating.address3 ? `, ${rating.address3}` : ""}, Jersey`.trim();
            const hash = crypto.createHash("sha256").update(address).digest("hex");
            const redisKey = `data-eatsafe-coords:${hash}`;

            try {
                const cached = await redis.getAsync(redisKey);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (
                        parsed.latitude &&
                        parsed.longitude &&
                        parsed.fetchedAt &&
                        (Date.now() - parsed.fetchedAt) < TWO_WEEKS_MS
                    ) {
                        rating.latitude = parsed.latitude;
                        rating.longitude = parsed.longitude;
                        log.trace(this.name, `Using cached coordinates for ${rating.name} (${++i}/${data.length})`);
                        continue;
                    }
                }

                const response = await geocodingClient.forwardGeocode({
                    query: address,
                    limit: 1
                }).send();

                if (response?.body?.features?.length > 0) {
                    const { center } = response.body.features[0];
                    rating.latitude = center[1];
                    rating.longitude = center[0];

                    await redis.setAsync(redisKey, JSON.stringify({
                        latitude: rating.latitude,
                        longitude: rating.longitude,
                        fetchedAt: Date.now()
                    }));

                    log.debug(this.name, `Fetched new coordinates for ${rating.name} (${++i}/${data.length})`);
                } else {
                    log.debug(this.name, `No coordinates found for ${rating.name} (${++i}/${data.length})`);
                }

                await this.wait(WAIT_MS);
            } catch (e: any) {
                log.error(this.name, `Failed to geocode ${rating.name}: ${e.message}`);
            }
        }

        await redis.setAsync("data-eatsafe:json", JSON.stringify(data));
    }

    protected async afterExecute(data: EatSafeRating[]): Promise<void> {
        log.info(this.name, `Processed ${data.length} Eat Safe ratings`);
    }

    private async wait(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
