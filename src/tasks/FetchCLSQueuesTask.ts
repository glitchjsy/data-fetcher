import nodeFetch, { Response } from "node-fetch";
import log from "../log";
import { CLSQueueInfo, CLSQueuesWrapper } from "../models/data/CLSQueues";
import { GovCLSQueuesWrapper } from "../models/gov/GovCLSQueues";
import Task from "./Task";

const DATA_URL = "https://sojpublicdata.blob.core.windows.net/cls/queues.json";

class FetchCLSQueuesTask extends Task<CLSQueuesWrapper> {

    constructor() {
        super("Fetch Customer & Local Services Queues");
    }

    public async execute(): Promise<CLSQueuesWrapper> {

        const transform = (data: GovCLSQueuesWrapper): CLSQueuesWrapper => {
            const queues: CLSQueueInfo[] = [];

            data.queues.forEach(queue => {
                queues.push({
                    name: queue.displayName,
                    queueId: queue.queueId,
                    color: queue.displayColour,
                    waiting: queue.customersWaiting,
                    waitingMinutes: queue.waitingTimeMinutes,
                    open: queue.open
                });
            });

            const niceDate = new Date(data.lastUpdated).toISOString().slice(0, 19).replace("T", " ");

            return { queues, timestamp: niceDate }
        }

        log.debug("Fetching CLS queues...");

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
}

const task = new FetchCLSQueuesTask();

const validateResponse = task.validateResponse;

export const fetchCLSQueues = task.execute;