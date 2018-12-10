import * as cheerio from "cheerio";
import * as moment from "moment";
import * as rp from "request-promise-native";
// import {inspect} from "util";

const finalsUrl = "https://registrar.uic.edu/current_students/calendars/final-exams";

/**
 * Information for the final exam for a class
 */
export interface IExamInfo {
    courseDept: string;        // e.g. CS
    courseNum: string;         // e.g. 141; formerly courseName
    courseId: Set<string>;     // CRN; formerly courseNum
    courseTime?: string;       //
    finalStart: string;        //
    finalEnd: string;          //
    finalLocations: string[];
}

/**
 * Trim leading '2' from building ID
 * @param b Building ID string
 */
function trimBldg(b: string): string {
    if (b[0] !== "2") {
        // TODO: LOG!
        return b;
    }
    return b.slice(1);
}

/**
 * Fetch finals information from page, scrape finals, and return list of exams
 */
export async function getFinals(): Promise<IExamInfo[]> {
    const pageHtml = await rp(finalsUrl);  // Fetch finals page html text
    const page = cheerio.load(pageHtml);   // Parse html into a navigable tree
    const finals = new Map<string, IExamInfo>();

    // Moment.js uses local time, don't worry about time zone
    const timeFormat = "ddd MMM D h:mm a";

    // Regex:           (1. Dept --)   (2. Number )   -   (3. CRN | ALL)
    const cell0REpt1 = /([A-Z]{2,4})\s+([0-9]{2,3})\s+-\s+([0-9]{5}|ALL)/;
    //                  (4. Time and Day ---------------------------------)
    //                   (5. Class Time                  ) (6. Class Days) Time/days optional
    const cell0REpt2 = /(([0-9]{1,2}:[0-9]{2}\s+(?:AM|PM)) (\([MTWRFS]+\)))?/;
    // Split into parts to avoid long line warnings
    // I tried doing the ["string1", "string2"].join("") trick first, but that
    //  didn't work because all the "\s"s turned into "s"s
    const cell0RE = new RegExp(cell0REpt1.source + cell0REpt2.source);

    // Regex:        (1. Start Time -----)   -   (2. End Time -------) (3. --)
    const cell2RE = /([0-9]{1,2}:[0-9]{2})\s+-\s+([0-9]{1,2}:[0-9]{2}) (am|pm)/;

    page("#finals > tbody").children("tr").each((i, elem) => {
        const tds = page(elem).children();

        const cell0 = cell0RE.exec(tds.eq(0).text().trim());
        const cell1 = tds.eq(1).text().trim(); // No regex necessary
        const cell2 = cell2RE.exec(tds.eq(2).text().trim());
        const cell3 = tds.eq(3).text().trim();
        const cell4 = tds.eq(4).text().trim();
        const cell5 = tds.eq(5).text().trim();

        if (!cell0 || !cell2) {
            // Something has gone wrong with the regex - skip
            console.log("Regex could not parse finals line:");
            console.log(tds.eq(0).text().trim());
            console.log(tds.eq(2).text().trim());
            return;
        }

        // Key: Dept Num Time
        const key = `${cell0[1]} ${cell0[2]} ${cell0[4]} ${cell1} ${cell2}`;

        // Only end time's "am/pm" is given
        // Determine whether start time is in morning or afternoon
        // Start time will be 'am' if either:
        //  - End time is 'am', or
        //  - Numeric hour of start time is greater than end time (e.g. 12 > 1) AND not equal to 12
        // Assumptions: no exam will ever be held across midnight
        const startHr = parseInt(cell2[1].split(":")[0], 10);
        const endHr = parseInt(cell2[2].split(":")[0], 10);
        const startTimeAMPM = (
            cell2[3] === "am" || ((startHr > endHr) && startHr !== 12)
        ) ? "am" : "pm";
        const startTimeString = `${cell1} ${cell2[1]} ${startTimeAMPM}`;
        const endTimeString = `${cell1} ${cell2[2]} ${cell2[3]}`;

        const startTime = moment(startTimeString, timeFormat);
        const endTime = moment(endTimeString, timeFormat);

        const locations: string[] = [];

        // Cell 4 probably only includes one room
        // However, it may also include multiple rooms in the same building, or
        //  multiple rooms in different buildings
        const c4Split = cell4.split(",");

        // Assumption: The "Comments" cell will either contain the text "Combined Section Final",
        //  OR an additional exam location
        // Assumption: If "Comments" has a value, "Building" and "Room" have values
        if (cell5 && cell5 !== "" && cell5 !== "Combined Section Final") {
            // Unusual; log TODO
            c4Split.push(cell5);
        }
        if (cell3.length > 0 && c4Split.length > 0) {
            // First character of building is (almost) always '2'
            let bldg = trimBldg(cell3);
            // locations.add(`${bldg} ${c4Split[0]}`);

            // Already used first; iterate through remaining comma-separated values
            for (let loc of c4Split) {
                loc = loc.trim();
                const locS = loc.split(/\s+/); // Trim spaces; split on one or more spaces
                if (locS.length === 1) {
                    // Room in same building as last entry
                    locations.push(`${bldg} ${loc}`);
                } else if (locS.length === 2) {
                    // Room in different building
                    bldg = trimBldg(locS[0]);
                    locations.push(`${bldg} ${locS[1]}`);
                } else {
                    // What is this? Log it.
                    // TODO
                }
            }
        }

        if (finals.has(key)) {
            const f = finals.get(key);
            if (!startTime.isSame(f.finalStart) || !endTime.isSame(f.finalEnd)) {
                // This is bad!
                console.log("ERROR - Same class, different exam times");
            }
            // Add CRN
            f.courseId.add(cell0[3]);
            // Add locations
            for (const loc of locations) { f.finalLocations.push(loc); }
        } else {
            finals.set(key, {
                courseDept: cell0[1],
                courseNum: cell0[2],
                courseId: (new Set<string>()).add(cell0[3]),
                courseTime: cell0[4],
                finalStart: startTime.format(),
                finalEnd: endTime.format(),
                finalLocations: locations,
            });
        }
    });

    return Array.from(finals.values()).sort((a, b) => {
        // Sort finals in list by their start time
        const aT = moment(a.finalStart);
        const bT = moment(b.finalStart);
        if (aT.isSame(bT)) {
            return 0;
        }
        if (aT.isBefore(bT)) {
            return -1;
        }
        return 1;
    });
}

