import log from "../log";
import mysql from "../mysql";
import Task from "./Task";
import crypto from "crypto";

const DATA_URL = "https://tstgojcourtssa.blob.core.windows.net/court-listings/courtListsResults.json";

type Listing = {
    appearanceDate: string;
    video: string;
    hearingPurpose: string;
    result: string;
    remandedOrBailed: string;
    nextAppearance: string | null;
    courtRoom: string;
    lawOfficer: string | null;
    defendant: string;
    magistrate: string;
    offences: string[];
};

export default class FetchCourtResultsTask extends Task {
    private weekHash: string | null = null;

    constructor() {
        super("Fetch Court Results", "court-results");
    }

    protected async fetchData(): Promise<any> {
        log.debug(this.name, `Fetching from ${DATA_URL}`);
        return this.fetchJson(DATA_URL);
    }

    protected validateData(data: any): any {
        if (!data || !Array.isArray(data)) {
            throw new Error("Invalid response: missing data or not an array");
        }
        if (!data[0].DateOfAppearance || !data[0].Courtroom) {
            throw new Error("Missing 'DateOfAppearance' or 'Courtroom'");
        }
        return data;
    }

    protected transformData(data: any): Listing[] {
        const sorted = [...data].sort((a, b) =>
            (a.DateOfAppearance + a.Courtroom + a.Defendant)
                .localeCompare(b.DateOfAppearance + b.Courtroom + b.Defendant)
        );

        this.weekHash = crypto
            .createHash("sha256")
            .update(JSON.stringify(sorted))
            .digest("hex");

        return sorted.map((listing: any) => ({
            appearanceDate: listing.DateOfAppearance,
            video: listing.Video,
            hearingPurpose: listing["Hearing Purpose"].trim(),
            result: listing.Result?.trim() || "",
            remandedOrBailed: listing["Remanded or Bailed"] || "",
            nextAppearance: listing["Next Apperance"] || null,
            courtRoom: listing.Courtroom.trim(),
            lawOfficer: listing["Law Officer"] || null,
            defendant: listing.Defendant.trim(),
            magistrate: listing.Magistrate || "",
            offences: Array.isArray(listing.Offences)
                ? listing.Offences.map((o: any) => o.Value.trim())
                : []
        }));
    }

    protected async persistData(data: Listing[]): Promise<void> {
        if (!this.weekHash || data.length === 0) return;

        const existing: any[] = await mysql.execute(
            `SELECT COUNT(*) as count FROM courtListingsWeeklyHashes WHERE hash = ?`,
            [this.weekHash]
        );

        const count = existing?.[0]?.count || 0;
        if (count > 0) {
            log.info(this.name, "This week's data already exists — skipping insert");
            return;
        }

        for (const listing of data) {
            const result: any = await mysql.execute(
                `INSERT INTO courtResults 
                (appearanceDate, video, hearingPurpose, result, remandedOrBailed, nextAppearanceDate, courtRoom, lawOfficer, defendant, magistrate)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    this.formatMySQLDate(listing.appearanceDate),
                    listing.video,
                    listing.hearingPurpose,
                    listing.result,
                    listing.remandedOrBailed,
                    this.formatMySQLDate(listing.nextAppearance),
                    listing.courtRoom,
                    listing.lawOfficer,
                    listing.defendant,
                    listing.magistrate
                ]
            );

            const listingId = result.insertId;

            for (const offence of listing.offences) {
                await mysql.execute(
                    `INSERT INTO courtResultOffences (listingId, offence) VALUES (?, ?)`,
                    [listingId, offence]
                );
            }
        }

        await mysql.execute(
            `INSERT INTO courtListingsWeeklyHashes (hash) VALUES (?)`,
            [this.weekHash]
        );
    }

    protected async afterExecute(data: Listing[]): Promise<void> {
        log.info(this.name, `Processed ${data.length} listings`);
    }

    private formatMySQLDate(dateString: string | null): string | null {
        if (!dateString) return null;
        return new Date(dateString).toISOString().split("T")[0];
    }
}
