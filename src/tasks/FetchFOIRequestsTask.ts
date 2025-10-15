import { load } from "cheerio";
import log from "../log";
import mysql from "../mysql";
import Task from "./Task";

interface FOIRequest {
    id: number;
    title: string;
    producer: string;
    author: string;
    publishDate: string | null;
    requestText: string;
    responseText: string;
}

const DATA_URL = "https://www.gov.je/government/freedomofinformation/pages/foi.aspx?ReportID=";

export default class FetchFOIRequestsTask extends Task {
    constructor() {
        super("Fetch Freedom of Information Requests", "foi-requests");
    }

    /**
     * Fetches the next FOI requests starting from the last ID in the DB.
     */
    protected async fetchData(): Promise<any> {
        const startId = await this.getStartId();
        const results: FOIRequest[] = [];

        let currentId = startId;

        while (true) {
            log.debug(this.name, `Fetching FOI Request (${currentId})`);

            let data: FOIRequest | null = null;
            let found = false;

            // Check the next 5 IDs in case of deleted FOI requests
            for (let offset = 0; offset < 5; offset++) {
                const nextData = await this.fetchSingleRequest(currentId + offset);

                if (nextData && nextData.title) {
                    data = nextData;
                    currentId += offset;
                    found = true;
                    break;
                }
            }

            if (!found) {
                log.info(this.name, `No FOI requests found in the next 5 IDs starting from ${currentId}. Stopping.`);
                break;
            }

            if (data) {
                this.persistDataReal(data);
                results.push(data);
            }
            currentId++;
        }

        return results;
    }

    protected validateData(data: any): FOIRequest[] {
        if (!Array.isArray(data)) {
            throw new Error("Invalid FOI data format");
        }
        return data;
    }

    protected async transformData(data: FOIRequest[]): Promise<FOIRequest[]> {
        return data;
    }

    protected async persistData(data: FOIRequest[]): Promise<void> {
        // nothing
    }

    protected async afterExecute(data: FOIRequest[]): Promise<void> {
        log.info(this.name, `Finished FOI scraping. Total inserted: ${data.length}`);
    }

    private async persistDataReal(item: FOIRequest): Promise<void> {
        try {
            await mysql.execute(
                `INSERT INTO foiRequests
                        (id, title, producer, author, publishDate, requestText, responseText)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    item.id,
                    item.title,
                    item.producer,
                    item.author,
                    this.formatForMySQL(item.publishDate),
                    item.requestText,
                    item.responseText
                ]
            );
            log.debug(this.name, `Inserted FOI request ${item.id} into database.`);
        } catch (err: any) {
            log.error(this.name, `Failed to insert FOI request ${item.id}: ${err.message}`);
        }
    }

    private async getStartId(): Promise<number> {
        try {
            const rows: { id: number }[] = await mysql.execute("SELECT MAX(id) as id FROM foiRequests");
            const maxId = rows[0]?.id;
            if (maxId) {
                log.debug(this.name, `Starting FOI scraping from ID ${maxId + 1}`);
                return maxId + 1;
            }
        } catch (err: any) {
            log.error(this.name, `Failed to get max ID from database: ${err.message}`);
        }
        return 1;
    }

    private async fetchSingleRequest(id: number): Promise<FOIRequest | null> {
        try {
            // Skip if already exists
            const existing = await mysql.execute("SELECT id FROM foiRequests WHERE id = ?", [id]);
            if (existing.length !== 0) {
                log.debug(this.name, `Skipping ${id} as it already exists`);
                return null;
            }

            const html = await this.fetchHtml(DATA_URL + id);
            const $ = await load(html);
            const div = $(".FOIContent > div").first();
            const contents = div.contents().toArray();

            let authoredBy = "";
            let publishedOn = "";

            contents.forEach(node => {
                if (node.type === "text") {
                    const text = node.data?.trim() ?? "";
                    if (text.startsWith("Authored by")) {
                        const match = text.match(/Authored by\s*(.*?)\s*and published on/i);
                        if (match) authoredBy = match[1].trim();
                        const nextNode = node.nextSibling as any;
                        if (nextNode?.type === "tag" && nextNode.name === "strong") {
                            publishedOn = $(nextNode).text().trim();
                        }
                    }
                }
            });

            const firstH2 = $(".FOIContent > div h2").filter((_, el) =>
                $(el).text().toLowerCase().includes("request")
            ).first();

            const secondH2 = $(".FOIContent > div h2").filter((_, el) =>
                $(el).text().toLowerCase().includes("response")
            ).first();

            return {
                id,
                title: $(".FOIContent > div > title").text(),
                producer: $(".FOIContent > div > strong").first().text().replace(/^Produced by\s*/i, "").trim(),
                author: authoredBy,
                publishDate: publishedOn ? publishedOn.replace(/\.$/, "") : null,
                requestText: firstH2.nextUntil("h2").map((_, el) => $.html(el)).get().join(""),
                responseText: secondH2.nextAll().map((_, el) => $.html(el)).get().join("")
            };
        } catch (e: any) {
            log.error(this.name, `Failed to fetch FOI request ${id}: ${e.message}`);
            return null;
        }
    }

    private formatForMySQL(dateStr: string | null): string | null {
        if (!dateStr) return null;
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return null;
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, "0");
        const dd = String(date.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
    }
}
