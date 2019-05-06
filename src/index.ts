import * as http from "http";
import * as Koa from "koa";
import * as logger from "koa-logger";
import * as kstatic from "koa-static";
import * as views from "koa-views";

import IExamInfo, {getFinals} from "./scraper";

const now = new Date();
const month = now.getMonth();

let SEMESTER: string;
if (month >= 1 && month <= 5)  {
    SEMESTER = "Spring";      // February through June
} else if (month >= 6 && month <= 8) {
    SEMESTER = "Summer";      // July through September
} else {
    SEMESTER = "Fall";        // October through January
}

const YEAR = now.getFullYear().toString();

let FINALSLIST: IExamInfo[];

function createApp(): (req: any, res: any) => any {
    // Use Koa to serve application
    // Koa is like Express but more async
    const app = new Koa();

    // app.use() adds the given function to the chain of functions run on each incoming
    // http request. Koa calls these functions "middleware" (and so does everyone else)

    // Register the logging middleware
    app.use(logger());

    // Register the static file serving middleware
    // Any files under the ./static subdirectory become available:
    // e.g. ./static/abc.html is served at http://[siteaddress].edu/abc.html
    app.use(kstatic("static"));

    // Register the template rendering middleware
    // This adds the ctx.response.render method, and sets .mst files to be rendered
    // with the Mustache engine
    const viewDirname = `${__dirname}/../views`;
    app.use(views(viewDirname, {
        map: {mst: "mustache"},
    }));

    // Our app logic goes here
    app.use(async (ctx, next) => {
        if (!FINALSLIST) {
            // If FINALSLIST is not populated, get finals and filter just the CS courses
            FINALSLIST = (await getFinals()).filter((xm) => xm.courseDept === "CS");
        }

        // In a larger application, you might use a router here, which connects
        //  url strings with functions. This is enough for us though.
        // Split to allow arbitrary query parameters
        switch (ctx.url.split("?")[0]) {
            case "/":
            case "/index.html":
                // Render index.mst into html, substituting the values in the object
                //  into the template.
                await ctx.render("./index.mst", {
                    semester: SEMESTER,
                    year: YEAR,
                    finalsList: FINALSLIST,
                });
                break;
            case "/api/finals":
                ctx.body = {
                    status: "success",
                    finals: FINALSLIST,
                };
                break;
        }
        // Static asset urls have already been handled earlier in the middleware chain,
        //  no need for us to test for those here
    });

    return app.callback();
}

if (!process.env.IS_NOW) {
    // This block is just for my deployment - the below code will always run in local development

    http.createServer(createApp()).listen(8080);

    // app.listen(8080);
    // Equivalent to:
    // http.createServer(app.callback()).listen(8080);
    // In other words, run Koa's function chain in response to an incoming http request on given port
}

export default (createApp());
