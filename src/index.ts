import { CronJob } from "cron";
import log from "./log";
import mysql from "./mysql";
import redis from "./redis";
import { TASKS } from "./registry";
import { fetchEatSafeRatings } from "./tasks/FetchEatSafeDataTask";
import { fetchParkingSpaces } from "./tasks/FetchParkingSpacesTask";
import { fetchProductRecalls } from "./tasks/FetchProductRecallsTask";

log.info("Starting data-fetcher");

TASKS.forEach(task => log.info("Loaded task " + task.name));

// Fetch parking spaces and update them in the database
function fetchParkingSpacesTask() {
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
}

function fetchProductRecallsTask() {
    fetchProductRecalls()
        .then(async (totalRecalls) => {
            log.debug(`Fetched data on ${totalRecalls} product recalls...`);
        });
}

function fetchEatSafeRatingsTask() {
    fetchEatSafeRatings()
        .then(async (ratings) => {
            log.debug(`Fetched eatsafe data on ${ratings.length} businesses...`);

            await redis.setAsync("data-eatsafe:json", JSON.stringify(ratings));
        }).catch(e => log.error("Failed to fetch eatsafe ratings: " + e.message));
}

/**
 * Registers cron jobs to periodically fetch data and update it
 * in the database.
 */
async function registerCronJobs() {
    // Run immediately
    fetchParkingSpacesTask();
    fetchEatSafeRatingsTask();
    fetchProductRecallsTask();

    // Then set up cron jobs to run periodically
    new CronJob("0 * * * *", () => fetchParkingSpacesTask()).start(); // every hour
    new CronJob("0 0 */2 * *", () => fetchEatSafeRatingsTask()).start(); // every 2 days
    new CronJob("*/5 * * * *", () => fetchProductRecallsTask()).start(); // every 5 minutes
}

registerCronJobs();