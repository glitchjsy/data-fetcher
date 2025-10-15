import log from "../log";
import mysql from "../mysql";
import Task from "./Task";

const DATA_URL = "https://tstgojcourtssa.blob.core.windows.net/court-listings/courtListsWeekly.json";

export default class FetchCourtListingsTask extends Task {
    constructor() {
        super("Fetch Court Listings");
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

    protected transformData(data: any): any {
        const listings = data.map((listing: any) => ({
            appearanceDate: listing.DateOfAppearance,
            courtRoom: listing.Courtroom,
            hearingPurpose: listing["Hearing Purpose"],
            defendant: listing.Defendant
        }));
        return listings;
    }

    protected async persistData(data: any): Promise<void> {
        for (const listing of data) {
            await mysql.execute(
                `INSERT IGNORE INTO courtListings (appearanceDate, courtRoom, hearingPurpose, defendant) VALUES (?, ?, ?, ?)`,
                [
                    this.formatMySQLDate(data.appearanceDate),
                    listing.courtRoom,
                    listing.hearingPurpose,
                    listing.defendant
                ]
            );
        }
    }

    protected async afterExecute(data: any): Promise<void> {
        log.info(this.name, `Successfully processed ${data.length} listings`);
    }

    private formatMySQLDate(dateString: string | null): string | null {
        if (!dateString) return null;
        return new Date(dateString).toISOString().split("T")[0];
    }
}
