import { CronJob } from "cron";
import log from "./log";
import redis from "./redis";
import FetchCLSQueuesTask from "./tasks/FetchCLSQueuesTask";
import FetchEatSafeDataTask from "./tasks/FetchEatSafeDataTask";
import FetchFOIRequestsTask from "./tasks/FetchFOIRequestsTask";
import FetchParkingSpacesTask from "./tasks/FetchParkingSpacesTask";
import FetchProductRecallsTask from "./tasks/FetchProductRecallsTask";
import FetchCourtListingsTask from "./tasks/FetchCourtListingsTask";

log.info("system", "Starting data-fetcher");

/**
 * Update the heartbeat time in redis for status checking.
 */
async function heartbeat() {
    log.debug("system", "Heatbeat sent");

    try {
        await redis.setAsync("data-fetcher-heartbeat", Date.now().toString());
    } catch (e: any) {
        log.error("system", "Failed to update heartbeat in redis: " + e.message);
    }
}

/**
 * Registers cron jobs to periodically fetch data and update it
 * in the database.
 */
async function registerCronJobs() {
    const fetchParkingSpacesTask = new FetchParkingSpacesTask();
    const fetchClsQueuesTask = new FetchCLSQueuesTask();
    const fetchEatSafeTask = new FetchEatSafeDataTask();
    const fetchFoiRequestsTask = new FetchFOIRequestsTask();
    const fetchProductRecallsTask = new FetchProductRecallsTask();
    const fetchCourtListingsTask = new FetchCourtListingsTask();

    // Run immediately
    fetchParkingSpacesTask.execute();
    fetchClsQueuesTask.execute();
    fetchEatSafeTask.execute();
    fetchFoiRequestsTask.execute();
    fetchProductRecallsTask.execute();
    fetchCourtListingsTask.execute();

    // Set up cron jobs to run periodically
    new CronJob("*/5 * * * *", () => fetchParkingSpacesTask.execute()).start(); // every 5 minutes
    new CronJob("*/15 * * * *", () => fetchClsQueuesTask.execute()).start(); // every 15 minutes
    new CronJob("0 0 */2 * *", () => fetchEatSafeTask.execute()).start(); // every 2 days
    new CronJob("0 */6 * * *", () => fetchFoiRequestsTask.execute()).start(); // every 6 hours
    new CronJob("30 */6 * * *", () => fetchProductRecallsTask.execute()).start(); // every 6 hours at half past the hour
    new CronJob("0 3 */1 * *", () => fetchCourtListingsTask.execute()).start(); // every day at 3am

    // Heartbeat
    heartbeat();
    new CronJob("*/1 * * * *", () => heartbeat()).start(); // every minute
}

registerCronJobs();