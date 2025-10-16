import log from "../log";
import mysql from "../mysql";
import Task from "./Task";

interface Listing {
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
}

const DATA_URL = "https://tstgojcourtssa.blob.core.windows.net/court-listings/courtListsResults.json";

export default class FetchMagistratesCourtResultsTask extends Task {

    constructor() {
        super("Fetch Magistrates Court Results", "magistates-court-results");
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
        const listings = data.map((listing: any) => ({
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

        // Remove duplicate "Youth" listings
        const seenYouth: Record<string, boolean> = {};
        const filtered = listings.filter((listing: any) => {
            if (listing.defendant === "Youth") {
                const key = `${listing.appearanceDate}|${listing.courtRoom}|${listing.hearingPurpose}`;
                if (seenYouth[key]) return false;
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
            const result: any = await mysql.execute(
                `INSERT INTO magistatesCourtResults 
                (appearanceDate, video, hearingPurpose, result, remandedOrBailed, nextAppearanceDate, courtRoom, lawOfficer, defendant, magistrate)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE result = result`,
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

            if (listingId > 0) {
                for (const offence of listing.offences) {
                    await mysql.execute(
                        `INSERT INTO magistratesCourtResultOffences (listingId, offence) VALUES (?, ?) ON DUPLICATE KEY UPDATE offence = offence`,
                        [listingId, offence]
                    );
                }
            }
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
