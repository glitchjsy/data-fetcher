import log from "./log";
import redis from "./redis";
import mysql from "./mysql";
import { TASKS } from "./registry";
import { fetchParkingSpaces } from "./tasks/FetchParkingSpacesTask";
import { CronJob } from "cron";
import config from "../config.json";
import { fetchProductRecalls } from "./tasks/FetchProductRecallsTask";

log.info("Starting data-fetcher");

TASKS.forEach(task => log.info("Loaded task " + task.name));

/**
 * Registers cron jobs to periodically fetch data and update it
 * in the database.
 */
async function registerCronJobs() {
    // every hour
    new CronJob("0 * * * *", () => {
        fetchProductRecalls()
            .then(async (totalRecalls) => {
                log.debug(`Fetched data on ${totalRecalls} product recalls...`);
            });
    }).start();

    // every 5 minutes
    new CronJob("*/5 * * * *", () => {
        // Fetch parking spaces and update them in the database
        fetchParkingSpaces()
            .then(async ({ carparks, timestamp }) => {
                log.debug(`Fetched data on ${carparks.length} carparks...`);

                await redis.setAsync("data-livespaces:json", JSON.stringify({ results: carparks, timestamp }));

                for (const carpark of carparks) {
                    await mysql.execute("INSERT INTO liveParkingSpaces (createdAt,name,code,spaces,status,open) VALUES (?,?,?,?,?,?)", [
                        timestamp,
                        carpark.name,
                        carpark.code,
                        carpark.spaces,
                        carpark.status,
                        carpark.open
                    ]);
                }
                log.debug("Updated in database");
            })
            .catch(e => log.error("Failed to fetch parking spaces: " + e.message));
    }).start();
}

registerCronJobs();