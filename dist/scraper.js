"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __values = (this && this.__values) || function (o) {
    var m = typeof Symbol === "function" && o[Symbol.iterator], i = 0;
    if (m) return m.call(o);
    return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
};
exports.__esModule = true;
var cheerio = require("cheerio");
var moment = require("moment");
var rp = require("request-promise-native");
// import {inspect} from "util";
var finalsUrl = "https://registrar.uic.edu/current_students/calendars/final-exams";
/**
 * Trim leading '2' from building ID
 * @param b Building ID string
 */
function trimBldg(b) {
    if (b[0] !== "2") {
        // TODO: LOG!
        return b;
    }
    return b.slice(1);
}
/**
 * Fetch finals information from page, scrape finals, and return list of exams
 */
function getFinals() {
    return __awaiter(this, void 0, void 0, function () {
        var pageHtml, page, finals, timeFormat, cell0REpt1, cell0REpt2, cell0RE, cell2RE;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, rp(finalsUrl)];
                case 1:
                    pageHtml = _a.sent();
                    page = cheerio.load(pageHtml);
                    finals = new Map();
                    timeFormat = "ddd MMM D h:mm a";
                    cell0REpt1 = /([A-Z]{2,4})\s+([0-9]{2,3})\s+-\s+([0-9]{5}|ALL)/;
                    cell0REpt2 = /(([0-9]{1,2}:[0-9]{2}\s+(?:AM|PM)) (\([MTWRFS]+\)))?/;
                    cell0RE = new RegExp(cell0REpt1.source + cell0REpt2.source);
                    cell2RE = /([0-9]{1,2}:[0-9]{2})\s+-\s+([0-9]{1,2}:[0-9]{2}) (am|pm)/;
                    page("#finals > tbody").children("tr").each(function (i, elem) {
                        var e_1, _a, e_2, _b;
                        var tds = page(elem).children();
                        var cell0 = cell0RE.exec(tds.eq(0).text().trim());
                        var cell1 = tds.eq(1).text().trim(); // No regex necessary
                        var cell2 = cell2RE.exec(tds.eq(2).text().trim());
                        var cell3 = tds.eq(3).text().trim();
                        var cell4 = tds.eq(4).text().trim();
                        var cell5 = tds.eq(5).text().trim();
                        if (!cell0 || !cell2) {
                            // Something has gone wrong with the regex - skip
                            console.log("Regex could not parse finals line:");
                            console.log(tds.eq(0).text().trim());
                            console.log(tds.eq(2).text().trim());
                            return;
                        }
                        // Key: Dept Num Time
                        var key = cell0[1] + " " + cell0[2] + " " + cell0[4] + " " + cell1 + " " + cell2;
                        // Only end time's "am/pm" is given
                        // Determine whether start time is in morning or afternoon
                        // Start time will be 'am' if either:
                        //  - End time is 'am', or
                        //  - Numeric hour of start time is greater than end time (e.g. 11 > 1) AND not equal to 12, or
                        //  - Numeric hour of end time is 12 and numeric hour of star time is < 12
                        // Assumptions: no exam will ever be held across midnight
                        var startHr = parseInt(cell2[1].split(":")[0], 10);
                        var endHr = parseInt(cell2[2].split(":")[0], 10);
                        var startTimeAMPM = (cell2[3] === "am" ||
                            ((startHr > endHr) && startHr !== 12) ||
                            (endHr === 12 && startHr < 12)) ? "am" : "pm";
                        var startTimeString = cell1 + " " + cell2[1] + " " + startTimeAMPM;
                        var endTimeString = cell1 + " " + cell2[2] + " " + cell2[3];
                        var startTime = moment(startTimeString, timeFormat);
                        var endTime = moment(endTimeString, timeFormat);
                        var locations = [];
                        // Cell 4 probably only includes one room
                        // However, it may also include multiple rooms in the same building, or
                        //  multiple rooms in different buildings
                        var c4Split = cell4.split(",");
                        // Assumption: The "Comments" cell will either contain the text "Combined Section Final",
                        //  OR an additional exam location
                        // Assumption: If "Comments" has a value, "Building" and "Room" have values
                        if (cell5 && cell5 !== "" && cell5 !== "Combined Section Final") {
                            // Unusual; log TODO
                            c4Split.push(cell5);
                        }
                        if (cell3.length > 0 && c4Split.length > 0) {
                            // First character of building is (almost) always '2'
                            var bldg = trimBldg(cell3);
                            try {
                                // locations.add(`${bldg} ${c4Split[0]}`);
                                // Already used first; iterate through remaining comma-separated values
                                for (var c4Split_1 = __values(c4Split), c4Split_1_1 = c4Split_1.next(); !c4Split_1_1.done; c4Split_1_1 = c4Split_1.next()) {
                                    var loc = c4Split_1_1.value;
                                    loc = loc.trim();
                                    var locS = loc.split(/\s+/); // Trim spaces; split on one or more spaces
                                    if (locS.length === 1) {
                                        // Room in same building as last entry
                                        locations.push(bldg + " " + loc);
                                    }
                                    else if (locS.length === 2) {
                                        // Room in different building
                                        bldg = trimBldg(locS[0]);
                                        locations.push(bldg + " " + locS[1]);
                                    }
                                    else {
                                        // What is this? Log it.
                                        // TODO
                                    }
                                }
                            }
                            catch (e_1_1) { e_1 = { error: e_1_1 }; }
                            finally {
                                try {
                                    if (c4Split_1_1 && !c4Split_1_1.done && (_a = c4Split_1["return"])) _a.call(c4Split_1);
                                }
                                finally { if (e_1) throw e_1.error; }
                            }
                        }
                        if (finals.has(key)) {
                            var f = finals.get(key);
                            if (!startTime.isSame(f.finalStart) || !endTime.isSame(f.finalEnd)) {
                                // This is bad!
                                console.log("ERROR - Same class, different exam times");
                            }
                            // Add CRN
                            f.courseId.add(cell0[3]);
                            try {
                                // Add locations
                                for (var locations_1 = __values(locations), locations_1_1 = locations_1.next(); !locations_1_1.done; locations_1_1 = locations_1.next()) {
                                    var loc = locations_1_1.value;
                                    f.finalLocations.push(loc);
                                }
                            }
                            catch (e_2_1) { e_2 = { error: e_2_1 }; }
                            finally {
                                try {
                                    if (locations_1_1 && !locations_1_1.done && (_b = locations_1["return"])) _b.call(locations_1);
                                }
                                finally { if (e_2) throw e_2.error; }
                            }
                        }
                        else {
                            finals.set(key, {
                                courseDept: cell0[1],
                                courseNum: cell0[2],
                                courseId: (new Set()).add(cell0[3]),
                                courseTime: cell0[4],
                                finalStart: startTime.format(),
                                finalEnd: endTime.format(),
                                finalLocations: locations
                            });
                        }
                    });
                    return [2 /*return*/, Array.from(finals.values()).sort(function (a, b) {
                            // Sort finals in list by their start time
                            var aT = moment(a.finalStart);
                            var bT = moment(b.finalStart);
                            if (aT.isSame(bT)) {
                                return 0;
                            }
                            if (aT.isBefore(bT)) {
                                return -1;
                            }
                            return 1;
                        })];
            }
        });
    });
}
exports.getFinals = getFinals;
