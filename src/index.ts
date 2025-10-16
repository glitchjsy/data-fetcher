import { CronJob } from "cron";
import readline from "readline";
import log from "./log";
import redis from "./redis";
import FetchCLSQueuesTask from "./tasks/FetchCLSQueuesTask";
import FetchEatSafeDataTask from "./tasks/FetchEatSafeDataTask";
import FetchFOIRequestsTask from "./tasks/FetchFOIRequestsTask";
import FetchParkingSpacesTask from "./tasks/FetchParkingSpacesTask";
import FetchProductRecallsTask from "./tasks/FetchProductRecallsTask";
import FetchMagistratesCourtHearingsTask from "./tasks/FetchMagistratesCourtHearingsTask";
import FetchMagistratesCourtResultsTask from "./tasks/FetchMagistratesCourtResultsTask";
import Task from "./tasks/Task";

export const TASKS: Task[] = [];

const fetchParkingSpacesTask = new FetchParkingSpacesTask();
const fetchClsQueuesTask = new FetchCLSQueuesTask();
const fetchEatSafeTask = new FetchEatSafeDataTask();
const fetchFoiRequestsTask = new FetchFOIRequestsTask();
const fetchProductRecallsTask = new FetchProductRecallsTask();
const fetchMagistratesCourtHearingsTask = new FetchMagistratesCourtHearingsTask();
const fetchMagistratesCourtResultsTask = new FetchMagistratesCourtResultsTask();

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
    // Run immediately
    fetchParkingSpacesTask.execute();
    fetchClsQueuesTask.execute();
    fetchEatSafeTask.execute();
    fetchFoiRequestsTask.execute();
    fetchProductRecallsTask.execute();
    fetchMagistratesCourtHearingsTask.execute();
    fetchMagistratesCourtResultsTask.execute();

    // Set up cron jobs to run periodically
    new CronJob("*/5 * * * *", () => fetchParkingSpacesTask.execute()).start(); // every 5 minutes
    new CronJob("*/15 * * * *", () => fetchClsQueuesTask.execute()).start(); // every 15 minutes
    new CronJob("0 0 */2 * *", () => fetchEatSafeTask.execute()).start(); // every 2 days
    new CronJob("0 */6 * * *", () => fetchFoiRequestsTask.execute()).start(); // every 6 hours
    new CronJob("30 */6 * * *", () => fetchProductRecallsTask.execute()).start(); // every 6 hours at half past the hour
    new CronJob("0 */1 * * *", () => fetchMagistratesCourtHearingsTask.execute()).start(); // every hour
    new CronJob("0 */1 * * *", () => fetchMagistratesCourtResultsTask.execute()).start(); // every hour

    // Heartbeat
    heartbeat();
    new CronJob("*/1 * * * *", () => heartbeat()).start(); // every minute
}

async function listenForCommands() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false
    });

    log.info("system", `Listening for commands. Type "help" for a list of tasks.`);

    rl.on("line", async (input) => {
        const trimmed = input.trim().toLowerCase();

        if (trimmed === "help") {
            log.info("system", "Available commands:");
            log.info("system", "  help                  - Show this message");
            log.info("system", "  task <task-name>      - Trigger a task manually");
            log.info("system", "  debug <on|off>        - Enable/disable debug logging");
            log.info("system", "  trace <on|off>        - Enable/disable trace logging");
            log.info("system", "Tasks:");
            TASKS.forEach(task => log.info("system", `  ${task.command}`));
            return;
        }

        if (trimmed.startsWith("task ")) {
            const taskName = trimmed.slice(5).trim();
            const task = TASKS.find(task => task.command.toLowerCase() === taskName);

            if (!task) {
                log.warn("system", `Task "${taskName}" not found. Type "help" to see all tasks.`);
                return;
            }

            log.info("system", `Manual trigger: ${task.name}`);
            try {
                await task.execute();
            } catch (err: any) {
                log.error("system", `Error executing ${task.name}: ${err.message}`);
            }
            return;
        }

         if (trimmed.startsWith("debug ")) {
            const value = trimmed.slice(6).trim();
            const enabled = value === "on";
            log.setDebug(enabled); 
            log.info("system", `Debug logging ${enabled ? "enabled" : "disabled"}`);
            return;
        }

        if (trimmed.startsWith("trace ")) {
            const value = trimmed.slice(6).trim();
            const enabled = value === "on";
            log.setTrace(enabled);
            log.info("system", `Trace logging ${enabled ? "enabled" : "disabled"}`);
            return;
        }

        log.warn("system", `Unknown command "${trimmed}". Type "help" for a list of commands.`);
    });
}

registerCronJobs();
listenForCommands();