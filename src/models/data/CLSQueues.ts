export interface CLSQueuesWrapper {
    queues: CLSQueueInfo[];
    timestamp: string;
}

export interface CLSQueueInfo {
    name?: string; // Not included in database, used for logging purposes only
    queueId: number;
    color: string;
    waiting: number;
    waitingMinutes: number;
    open: boolean;
}