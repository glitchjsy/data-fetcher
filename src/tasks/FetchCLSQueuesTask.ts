import log from "../log";
import mysql from "../mysql";
import redis from "../redis";
import Task from "./Task";

interface CLSQueuesWrapper {
    queues: CLSQueueInfo[];
    timestamp: string;
}

interface CLSQueueInfo {
    name?: string; // Not included in database, used for logging purposes only
    queueId: number;
    color: string;
    waiting: number;
    waitingMinutes: number;
    open: boolean;
}

const DATA_URL = "https://sojpublicdata.blob.core.windows.net/cls/queues.json";

export default class FetchCLSQueuesTask extends Task {
    constructor() {
        super("Fetch Customer & Local Services Queues", "cls-queues");
    }

    protected async fetchData(): Promise<any> {
        log.debug(this.name, `Fetching from ${DATA_URL}`);
        return this.fetchJson(DATA_URL);
    }

    protected validateData(data: any): any {
        if (!data || !Array.isArray(data.queues)) {
            throw new Error("Invalid response: 'queues' missing or not an array");
        }
        if (!data.lastUpdated) {
            throw new Error("Missing 'lastUpdated'");
        }
        return data as any;
    }

    protected transformData(data: any): CLSQueuesWrapper {
        const queues: CLSQueueInfo[] = data.queues.map((queue: any) => ({
            name: queue.displayName,
            queueId: queue.queueId,
            color: queue.displayColour,
            waiting: queue.customersWaiting,
            waitingMinutes: queue.waitingTimeMinutes,
            open: queue.open,
        }));

        const timestamp = new Date(data.lastUpdated)
            .toISOString()
            .slice(0, 19)
            .replace("T", " ");

        return { queues, timestamp };
    }

    protected async persistData(data: CLSQueuesWrapper): Promise<void> {
        await redis.setAsync("data-clsqueues:json", JSON.stringify({
            results: data.queues,
            timestamp: data.timestamp
        }));

        for (const queue of data.queues) {
            await mysql.execute("INSERT INTO liveClsQueuesData (createdAt,name,queueId,color,open,waiting,waitingMinutes) VALUES (?,?,?,?,?,?,?)", [
                data.timestamp,
                queue.name,
                queue.queueId,
                queue.color,
                queue.open,
                queue.waiting,
                queue.waitingMinutes
            ]);
        }
    }

    protected async afterExecute(data: CLSQueuesWrapper): Promise<void> {
        log.info(this.name, `Successfully processed ${data.queues.length} queues`);
    }
}
