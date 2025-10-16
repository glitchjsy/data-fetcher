import log from "../log";
import mysql from "../mysql";
import Task from "./Task";

interface Listing {
    appearanceDate: string;
    courtRoom: string;
    hearingPurpose: string;
    defendant: string;
}

const DATA_URL = "https://tstgojcourtssa.blob.core.windows.net/court-listings/courtListsWeekly.json";

export default class FetchMagistratesCourtListingsTask extends Task {

    constructor() {
        super("Fetch Magistrates Court Listings", "magistrates-court-listings");
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
            throw new Error("Missing 'DateOfAppearance' or `Courtroom`");
        }
        return data;
    }

    protected transformData(data: any): Listing[] {
        const listings = data.map((item: any) => ({
            appearanceDate: item.DateOfAppearance,
            courtRoom: item.Courtroom.trim(),
            hearingPurpose: item["Hearing Purpose"].trim(),
            defendant: item.Defendant.trim(),
        }));

        // Remove duplicate "Youth" listings
        const seenYouth: Record<string, boolean> = {};
        const filtered = listings.filter((listing: any) => {
            if (listing.defendant === "Youth") {
                const key = `${listing.appearanceDate}|${listing.courtRoom}|${listing.hearingPurpose}`;
                if (seenYouth[key]) {
                    return false;
                }
                seenYouth[key] = true;
            }
            return true;
        });

        return filtered.sort((a: any, b: any) =>
            (a.appearanceDate + a.courtRoom + a.defendant).localeCompare(b.appearanceDate + b.courtRoom + b.defendant)
        );
    }

    protected async persistData(data: Listing[]): Promise<void> {
        if (!data || data.length === 0) return;

        for (const listing of data) {
            await mysql.execute(
                `INSERT INTO magistratesCourtHearings (appearanceDate, courtRoom, hearingPurpose, defendant)
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE defendant = defendant`,
                [
                    this.formatMySQLDate(listing.appearanceDate),
                    listing.courtRoom,
                    listing.hearingPurpose,
                    listing.defendant
                ]
            );
        }
    }

    protected async afterExecute(data: Listing[]): Promise<void> {
        log.info(this.name, `Processed ${data.length} listings`);
    }

    private formatMySQLDate(dateString: string | null): string | null {
        if (!dateString) return null;
        return new Date(dateString).toISOString().split("T")[0];
    }
}
