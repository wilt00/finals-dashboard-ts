import cheerio from "cheerio";
import moment from "moment";
import rp from "request-promise-native";

const finalsUrl = "https://registrar.uic.edu/current_students/calendars/final-exams";

/**
 * Information for the final exam for a class
 */
export default interface ExamInfo {
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
export async function getFinals(): Promise<ExamInfo[]> {
    const pageHtml = await rp(finalsUrl, {}, (): void => {});  // Fetch finals page html text
    const page = cheerio.load(pageHtml);   // Parse html into a navigable tree
    const finals = new Map<string, ExamInfo>();

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

    // Regex:                   (1. Start Time -----)   (2. - )        (3. End Time -------) (4. --)
    const cell2RE = new RegExp(/([0-9]{1,2}:[0-9]{2})\s*(am|pm)?\s*-\s+([0-9]{1,2}:[0-9]{2}) (am|pm)/, "i");

    // Match room number strings
    //              Begins w/ "2" - omit from capture group
    //              |    2 or more letters
    //              |    |        One space
    //              |    |        | Maybe one letter
    //              |    |        | |     One or more numbers
    const roomRE = /2\s?([A-Z]{2,}\s[A-Z]?[0-9]+)/;

    const getCell = (tds: Cheerio, i: number): string => tds.eq(i).text().trim();

    page("#finals > tbody").children("tr").each((i, elem): void => {
        const tds = page(elem).children();

        const courseCell = cell0RE.exec(getCell(tds, 0));
        const dayCell = getCell(tds, 1); // No regex necessary
        const timeCell = cell2RE.exec(getCell(tds, 2));
        const bldgCell = getCell(tds, 3);
        const roomCell = getCell(tds, 4);
        const commentCell = getCell(tds, 5);

        if (!courseCell || !timeCell) {
            // Something has gone wrong with the regex - skip
            console.log("Regex could not parse finals line:");
            console.log(`Parsed: ${getCell(tds, 0)} \n to:`);
            console.log(courseCell); // Expect regex object
            console.log(` and parsed: ${getCell(tds, 2)} \n to: ${timeCell}`);
            return;
        }

        // Key: Dept Num Time
        const key = `${courseCell[1]} ${courseCell[2]} ${courseCell[4]} ${dayCell} ${timeCell}`;

        // *Usually* Only end time's "am/pm" is given
        // Determine whether start time is in morning or afternoon
        // Start time will be 'am' if either:
        //  - End time is 'am', or
        //  - Numeric hour of start time is greater than end time (e.g. 11 > 1) AND not equal to 12, or
        //  - Numeric hour of end time is 12 and numeric hour of star time is < 12
        // Assumptions: no exam will ever be held across midnight
        //              no exam will ever start before 7:00 AM
        //              no exam will ever finish after 10:00 PM
        const startHr = parseInt(timeCell[1].split(":")[0], 10);
        const endHr = parseInt(timeCell[3].split(":")[0], 10);
        let startTimeAMPM;
        if (timeCell[2]) {
            // If we have one, use it
            startTimeAMPM = timeCell[2].toLowerCase();
        } else if (timeCell[3] === "am") {
            // If end time is in the morning, start time must also have been
            startTimeAMPM = "am";
        } else if ((startHr > endHr) && startHr !== 12) {
            // If start hour is larger than end hour, and not 12
            startTimeAMPM = "am";
        } else if (endHr === 12 && startHr < 12) {
            // Strict less than, since 12pm is afternoon
            startTimeAMPM = "am";
        } else {
            startTimeAMPM = "pm";
        }

        const endTimeAMPM = timeCell[4].toLowerCase();

        if (startHr > 12 || endHr > 12) {
            console.log(`Invalid time for key: ${key}`);
            console.log(`Either start time ${startHr} or end time ${endHr} is not 12-hr-formatted`);
        }
        if (startHr <= 7 && startTimeAMPM === "am") {
            console.log(`Invalid time for key: ${key}`);
            console.log(`Start time of ${startHr} ${startTimeAMPM} is improbable`);
        }
        if (endHr >= 10 && endHr !== 12 && endTimeAMPM === "pm") {
            console.log(`Invalid time for key: ${key}`);
            console.log(`End time of ${endHr} ${endTimeAMPM} is improbable`);
        }

        const startTimeString = `${dayCell} ${timeCell[1]} ${startTimeAMPM}`;
        const endTimeString = `${dayCell} ${timeCell[3]} ${endTimeAMPM}`;

        const startTime = moment(startTimeString, timeFormat);
        const endTime = moment(endTimeString, timeFormat);

        const locations: string[] = [];

        // Cell 4 probably only includes one room
        // However, it may also include multiple rooms in the same building, or
        //  multiple rooms in different buildings

        if ((!bldgCell && roomCell) || (bldgCell && !roomCell)) {
            console.log(`Unexpected format for key: ${key}`);
            console.log(`Exactly one of building or room is missing`);
        }

        const roomSplit = (roomCell) ? roomCell.split(",") : [];

        // Old Assumption: The "Comments" cell will either contain the text
        //  "Combined Section Final", OR an additional exam location
        // INVALID!
        // There does not appear to be a correlation between "Comments" text
        //  and number of rooms

        // Assumption: If "Comments" has a value, "Building" and "Room" have values

        // Assumption: "Comments" value is always "Combined Section Final"
        //   OR an incorrectly placed room number
        // If not, log and push to locations list
        if (commentCell && commentCell !== "" && commentCell !== "Combined Section Final") {
            const rm = roomRE.exec(commentCell);
            if (rm !== null) {
                const room = rm[1];
                console.log(`Detected room in comment cell for key: ${key}`);
                console.log(`Adding room: ${room}`);
                roomSplit.push(room);
            } else {
                console.log(`Unexpected format for key: ${key}`);
                console.log(`Comment text was: ${commentCell}`);
            }
        }

        if (bldgCell && bldgCell.length > 0 && roomSplit.length > 0) {
            // First character of building is (almost) always '2'
            let bldg = trimBldg(bldgCell);
            // locations.add(`${bldg} ${c4Split[0]}`);

            // Already used first; iterate through remaining comma-separated values
            for (let loc of roomSplit) {
                loc = loc.trim();
                const locS = loc.split(/\s+/); // Trim spaces; split on one or more spaces
                if (locS.length === 1) {
                    // Room in same building as last entry
                    locations.push(`${bldg} ${loc}`);
                } else if (locS.length === 2) {
                    // Room in different building
                    bldg = trimBldg(locS[0]);
                    locations.push(`${bldg} ${locS[1]}`);
                } else if (locS.length === 3 && locS[0] === "2") {
                    // Initial '2' is separated by space (unusual)
                    console.log(`Attempting to handle room description ${loc} for key: ${key}`);
                    bldg = locS[1];
                    const newLoc = `${bldg} ${locS[2]}`;
                    console.log(`Inserting location: ${newLoc}`);
                    locations.push(newLoc);
                } else {
                    // What is this? Log it.
                    console.log(`Unexpected value in room description for key: ${key}`);
                    console.log(`Value was: ${loc}`);
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
            f.courseId.add(courseCell[3]);
            // Add locations
            for (const loc of locations) {
                if (f.finalLocations.indexOf(loc) < 0) {
                    f.finalLocations.push(loc);
                }
            }
        } else {
            finals.set(key, {
                courseDept: courseCell[1],
                courseNum: courseCell[2],
                courseId: (new Set<string>()).add(courseCell[3]),
                courseTime: courseCell[4],
                finalStart: startTime.format(),
                finalEnd: endTime.format(),
                finalLocations: locations,
            });
        }
    });

    return Array.from(finals.values()).sort((a, b): number => {
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

