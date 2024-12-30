// https://sojpublicdata.blob.core.windows.net/cls/queues.json

export interface GovCLSQueuesWrapper {
    lastUpdated: string;
    message: string;
    errorCode: string;
    queues: GovCLSQueueInfo[];
}

export interface GovCLSQueueInfo {
    queueId: number;
    displayName: string;
    displayColour: string;
    displayColourLabel: string;
    displayOrder: number;
    customersWaiting: number;
    open: boolean;
    waitingTimeMinutes: number;
}