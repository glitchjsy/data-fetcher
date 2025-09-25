import { load } from "cheerio";
import nodeFetch, { Response } from "node-fetch";
import log from "../log";
import { ProductRecall } from "../models/data/ProductRecalls";
import mysql from "../mysql";
import Task from "./Task";

const DATA_URL = "https://www.gov.je/stayingsafe/consumerprotection/productsafety/Pages/ProductRecalls.aspx";

class FetchProductRecallsTask extends Task<number> {

    constructor() {
        super("Fetch Product Recalls");
    }

    public async execute(): Promise<number> {
        log.debug("Fetching product recalls...");

        const response = await nodeFetch(DATA_URL);
        const html = await response.text();
        const $ = await load(html);

        const resultsElement = $(".reportlistitem > .results > li");
        const results = [] as any[];

        resultsElement.each((i, result) => {
            const link = "https://gov.je" + $(result).find("a").attr("href");
            const regex = /[?&]RecallId=(\d+)/;
            const match = link.match(regex);

            if (!match) {
                return log.warn(`Failed to extract recall ID from ${link}`);
            }

            results.push({
                link,
                id: match[1]
            });
        });

        const output = [] as any[];
        const errors = [] as any[];

        let i = 0;
        let totalRecalls = 1;

        for (const result of results) {
            try {
                const existing = await mysql.execute("SELECT id FROM productRecalls WHERE id = ?", [parseInt(result.id)]);

                if (existing.length !== 0) {
                    i++;
                    log.debug(`Skipping ${result.id} as it already exists in the database`);
                    continue;
                }

                log.debug(`Fetching recall ${++i}/${results.length}`);

                const response = await nodeFetch(result.link);
                const $ = await load(await response.text());

                const tableData = {} as any;

                $("table tbody tr").each((i, element) => {
                    const key = $(element).find("th").text().trim();
                    const value = $(element).find("td").html()?.trim();
                    tableData[key] = value;
                });

                const data = {
                    id: parseInt(result.id),
                    title: $(".title").text(),
                    imageUrl: $(".item > img").length === 0 ? null : "https://gov.je" + $(".item > img").attr("src"),
                    brand: tableData.Brand,
                    recallDate: new Date(Date.parse(tableData["Recall date"].replace(/(\d{2}) (\w{3}) (\d{4})/, '$2 $1, $3'))),
                    packSize: tableData["Pack size"] === "" ? null : tableData["Pack size"],
                    batchCodes: tableData["Batch codes"] === "" ? null : tableData["Batch codes"],
                    problem: tableData.Problem,
                    furtherInformation: tableData["Further information"],
                    websiteUrl: tableData.Website === "" ? null : $(tableData.Website).attr("href")
                } as ProductRecall;

                await mysql.execute("INSERT INTO productRecalls (id,title,imageUrl,brand,recallDate,packSize,batchCodes,problem,furtherInformation,websiteUrl) VALUES (?,?,?,?,?,?,?,?,?,?)", [
                    data.id,
                    data.title,
                    data.imageUrl,
                    data.brand,
                    data.recallDate,
                    data.packSize,
                    data.batchCodes,
                    data.problem,
                    data.furtherInformation,
                    data.websiteUrl
                ]);

                totalRecalls++;
            } catch (e: any) {
                errors.push({
                    error: e.message,
                    result
                });
                log.error(e.message + " --- " + JSON.stringify(result));
            }
        }

        if (errors.length !== 0) {
            errors.forEach(e => log.error(`${e.message} --- ${JSON.stringify(e.result)}`));
        }

        return totalRecalls;
    }

    public async validateResponse(response: Response): Promise<any> {
        if (response.status !== 200) {
            throw new Error(`Received unexpected status code (${response.status})`);
        }
        const json = await response.json();

        return json;
    }
}

const task = new FetchProductRecallsTask();

const validateResponse = task.validateResponse;

export const fetchProductRecalls = task.execute;