import { load } from "cheerio";
import mysql from "../mysql";
import log from "../log";
import Task from "./Task";

interface RecallListing {
    id: number;
    link: string;
}

interface ProductRecallsWrapper {
    recalls: ProductRecall[];
}

interface ProductRecall {
    id: number;
    title: string;
    imageUrl: string | null;
    brand: string;
    recallDate: Date;
    packSize: string | null;
    batchCodes: string | null;
    problem: string;
    furtherInformation: string;
    websiteUrl: string | null;
}

const DATA_URL = "https://www.gov.je/stayingsafe/consumerprotection/productsafety/Pages/ProductRecalls.aspx";

export default class FetchProductRecallsTask extends Task {
    
    constructor() {
        super("Fetch Product Recalls");
    }

    protected async fetchData(): Promise<RecallListing[]> {
        log.debug(this.name, "Fetching product recall listing page...");
        
        const html = await this.fetchHtml(DATA_URL);
        const $ = load(html);

        const results: RecallListing[] = [];

        $(".reportlistitem > .results > li").each((_, result) => {
            const link = "https://gov.je" + $(result).find("a").attr("href");
            const match = link.match(/[?&]RecallId=(\d+)/);
            if (!match) {
                log.warn(this.name, `Failed to extract recall ID from ${link}`);
                return;
            }
            results.push({ id: parseInt(match[1]), link });
        });

        return results;
    }

    protected validateData(data: any): RecallListing[] {
        if (!Array.isArray(data)) {
            throw new Error("Invalid product recalls data format");
        }
        return data;
    }

    protected async transformData(data: RecallListing[]): Promise<ProductRecall[]> {
        const output: ProductRecall[] = [];

        let processed = 0;
        for (const item of data) {
            // Check if already exists
            const existing = await mysql.execute("SELECT id FROM productRecalls WHERE id = ?", [item.id]);
            if (existing.length !== 0) {
                log.trace(this.name, `Skipping ${item.id} (already in database)`);
                processed++;
                continue;
            }

            try {
                log.debug(this.name, `Fetching recall details ${++processed}/${data.length}`);
                const recallHtml = await this.fetchHtml(item.link);
                const $ = load(recallHtml);

                const tableData: Record<string, string | undefined> = {};
                
                $("table tbody tr").each((_, element) => {
                    const key = $(element).find("th").text().trim();
                    const value = $(element).find("td").html()?.trim();
                    tableData[key] = value;
                });

                const recallDate = tableData["Recall date"];
                const parsedRecallDate = recallDate
                    ? new Date(Date.parse(recallDate.replace(/(\d{2}) (\w{3}) (\d{4})/, "$2 $1, $3")))
                    : null;

                const websiteHtml = tableData["Website"];
                const websiteUrl = websiteHtml ? load(websiteHtml)("a").attr("href") ?? null : null;

                const recall = {
                    id: item.id,
                    title: $(".title").text(),
                    imageUrl: $(".item > img").length === 0 ? null : "https://gov.je" + $(".item > img").attr("src"),
                    brand: tableData["Brand"] || null,
                    recallDate: parsedRecallDate,
                    packSize: tableData["Pack size"] || null,
                    batchCodes: tableData["Batch codes"] || null,
                    problem: tableData["Problem"] || null,
                    furtherInformation: tableData["Further information"] || null,
                    websiteUrl
                } as ProductRecall;

                output.push(recall);
            } catch (e: any) {
                log.error(this.name, `Failed to fetch recall ${item.id}: ${e.message}`);
            }
        }

        return output;
    }

    protected async persistData(data: ProductRecall[]): Promise<void> {
        for (const recall of data) {
            try {
                await mysql.execute(
                    `INSERT INTO productRecalls
                        (id, title, imageUrl, brand, recallDate, packSize, batchCodes, problem, furtherInformation, websiteUrl)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        recall.id,
                        recall.title,
                        recall.imageUrl,
                        recall.brand,
                        recall.recallDate,
                        recall.packSize,
                        recall.batchCodes,
                        recall.problem,
                        recall.furtherInformation,
                        recall.websiteUrl
                    ]
                );
                log.debug(this.name, `Inserted recall ${recall.id} into database.`);
            } catch (err: any) {
                log.error(this.name, `Failed to insert recall ${recall.id}: ${err.message}`);
            }
        }
    }

    protected async afterExecute(data: ProductRecall[]): Promise<void> {
        log.info(this.name, `Finished product recall scraping. Total new recalls: ${data.length}`);
    }
}
