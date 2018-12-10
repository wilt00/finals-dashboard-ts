import * as Koa from "koa";
import * as views from "koa-views";

import {getFinals, IExamInfo} from "./scraper";

const SEMESTER = "Fall";
const YEAR = "2018";

let FINALSLIST: IExamInfo[];

// Use Koa to serve application
// Koa is like Express but more async
const app = new Koa();

// app.use() adds the given function to the chain of functions run on each incoming
// http request. Koa calls these functions "middleware" (and so does everyone else)

// Register the template rendering middleware
// This adds the ctx.response.render method, and sets .mst files to be rendered
// with the Mustache engine
app.use(views(`${__dirname}/../views`, {
    map: {mst: "mustache"},
}));

// Our app logic goes here
app.use(async (ctx, next) => {
    if (!FINALSLIST) {
        // If FINALSLIST is not populated, get finals and filter just the CS courses
        FINALSLIST = (await getFinals()).filter((xm) => xm.courseDept === "CS");
    }
    // Render index.mst into html, substituting the values in the object into the
    //  template.
    // No matter what the user asks for, we always give them the main page
    // This will be a problem for static assets, favicons, scripts, etc.
    await ctx.render("./index.mst", {
        semester: SEMESTER,
        year: YEAR,
        finalsList: FINALSLIST,
    });
});

app.listen(8080);
// Equivalent to:
// http.createServer(app.callback()).listen(8080);
// In other words, run Koa's function chain in response to an incoming http request on given port


// Test code
/*
getFinals()
.then((finals) => {
    console.log(inspect(
        finals.filter((final) => final.courseDept === "CS"),
        {showHidden: false, depth: null}),
    );
    FINALSLIST = finals;
}).catch((err) => {
    console.log(err);
});
*/
