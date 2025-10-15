import nodeFetch from "node-fetch";
import log from "../log";
import { TASKS } from "..";

export default abstract class Task {
    public name: string;
    public command: string;

    constructor(name: string, command: string) {
        this.name = name;
        this.command = command;
        TASKS.push(this);
        log.info("system", `Loaded task ${name}`);
    }

    public async execute(...args: any[]): Promise<void> {
        const start = Date.now();
        try {
            const rawData = await this.fetchData(...args);
            const validated = this.validateData(rawData);
            const transformed = await this.transformData(validated);
            await this.persistData(transformed);
            await this.afterExecute(transformed);
        } catch (e: any) {
            log.error(this.name, `Task failed: ${e.message}`);
        } finally {
            const ms = Date.now() - start;
            log.debug(this.name, `Task completed in ${ms}ms`);
        }
    }


    /**
     * Handles fetching the data from a web page or API endpoint.
     */
    protected abstract fetchData(...args: any[]): Promise<any>;

    /**
     * Handles data validation to ensure the data we fetched matches 
     * what we expect.
     */
    protected abstract validateData(data: any): any;

    /**
     * Handles converting the data to the required structure.
     */
    protected abstract transformData(data: any): Promise<any> | any;

    /**
     * Handles storing the transformed data in Redis or MySQL.
     */
    protected abstract persistData(data: any): Promise<void>;

    /**
     * Handles console logging and anything else that needs doing.
     */
    protected abstract afterExecute(data: any): Promise<void>;

    /**
     * Helper method for fetching JSON.
     */
    protected async fetchJson(url: string): Promise<any> {
        const response = await nodeFetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${url} (status ${response.status})`);
        }
        return response.json();
    }

    /**
     * Helper method for fetching HTML.
     */
    protected async fetchHtml(url: string): Promise<string> {
        const response = await nodeFetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${url} (status ${response.status})`);
        }
        return response.text();
    }
}