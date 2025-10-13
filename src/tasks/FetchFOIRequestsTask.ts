import { Element, load } from "cheerio";
import nodeFetch, { Response } from "node-fetch";
import log from "../log";
import { ProductRecall } from "../models/data/ProductRecalls";
import mysql from "../mysql";
import Task from "./Task";

const DATA_URL = "https://www.gov.je/government/freedomofinformation/pages/foi.aspx?ReportID=";

class FetchFOIRequestsTask extends Task<number> {

    constructor() {
        super("Fetch Freedom of Information Requests");
    }

    public async execute(): Promise<number> {
        log.debug("Fetching FOI requests...");

        function formatForMySQL(dateStr: string) {
            // Example input: "03 February 2015"
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) {
                return null; // invalid date
            }
            const yyyy = date.getFullYear();
            const mm = String(date.getMonth() + 1).padStart(2, "0"); // months are 0-based
            const dd = String(date.getDate()).padStart(2, "0");
            return `${yyyy}-${mm}-${dd}`;
        }

        const fetchRequest = async (id: number) => {
            try {
                const existing = await mysql.execute("SELECT id FROM foiRequests WHERE id = ?", [id]);

                if (existing.length !== 0) {
                    log.debug(`Skipping ${id} as it already exists in the database`);
                    return;
                }

                const response = await nodeFetch(DATA_URL + id);
                const $ = await load(await response.text());

                // Select the first div inside .FOIContent
                const div = $(".FOIContent > div").first();

                // Get all contents (text nodes and elements)
                const contents = div.contents().toArray();

                let authoredBy = "";
                let publishedOn = "";

                contents.forEach(node => {
                    if (node.type === "text") {
                        const text = node.data?.trim() ?? "";
                        if (text.startsWith("Authored by")) {
                            // Extract authoredBy
                            const match = text.match(/Authored by\s*(.*?)\s*and published on/i);
                            if (match) authoredBy = match[1].trim();

                            // For publishedOn, check if next node is <strong>
                            const nextNode = node.nextSibling as Element | undefined;
                            if (nextNode?.type === "tag" && (nextNode as Element).name === "strong") {
                                publishedOn = $(nextNode).text().trim();
                            }
                        }
                    }
                });

                const firstH2 = $(".FOIContent > div h2").first();
                const secondH2 = $(".FOIContent > div h2").eq(1);

                const data = {
                    id,
                    title: $(".FOIContent > div > title").text(),
                    producer: $(".FOIContent > div > strong").first().text().replace(/^Produced by\s*/i, "").trim(),
                    author: authoredBy,
                    publishDate: publishedOn.trim().replace(/\.$/, ''),
                    requestText: firstH2.nextUntil("h2").map((i, el) => $.html(el)).get().join(""),
                    responseText: secondH2.nextAll().map((i, el) => $.html(el)).get().join("")
                } as any;

                return data;
            } catch (e: any) {
                return e.message;
            }
        }

        let startId = 1;
        try {
            const rows: { id: number }[] = await mysql.execute(
                "SELECT MAX(id) as id FROM foiRequests"
            );
            const maxId = rows[0]?.id;
            if (maxId) startId = maxId + 1;
            log.debug(`Starting FOI scraping from ID ${startId}`);
        } catch (err: any) {
            log.error(`Failed to get max ID from database: ${err.message}`);
            startId = 1;
        }

        let i = startId;
        const results: any[] = [];

        while (true) {
            log.info(`Fetching FOI Request (${i})`);

            let data = null;
            let found = false;

            // Check the next 5 as sometimes we encounter a deleted FOI request
            for (let offset = 0; offset < 5; offset++) {
                const nextData = await fetchRequest(i + offset);

                if (nextData && nextData.title) {
                    data = nextData;
                    found = true;
                    i += offset;
                    break;
                }
            }
            if (!found) {
                log.info(`No FOI requests found in the next 5 IDs starting from ${i}. Stopping.`);
                break;
            }

            results.push(data);

            try {
                await mysql.execute(
                    `INSERT INTO foiRequests
            (id, title, producer, author, publishDate, requestText, responseText)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [
                        data.id,
                        data.title,
                        data.producer,
                        data.author,
                        formatForMySQL(data.publishDate),
                        data.requestText,
                        data.responseText
                    ]
                );
                log.debug(`Inserted FOI request ${data.id} into database.`);
            } catch (err: any) {
                log.error(`Failed to insert FOI request ${data.id}: ${err.message}`);
            }

            i++;
        }
        return i;
    }

    public async validateResponse(response: Response): Promise<any> {
        if (response.status !== 200) {
            throw new Error(`Received unexpected status code (${response.status})`);
        }
        const json = await response.json();

        return json;
    }
}

const task = new FetchFOIRequestsTask();

const validateResponse = task.validateResponse;

export const fetchFOIRequests = task.execute;