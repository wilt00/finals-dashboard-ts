# UIC Finals Dashboard
UIC ACM finals countdown wall, rewritten for simplicity
## Screenshot
![Screenshot](https://github.com/bmiddha/finals-dashboard-ts/blob/master/screenshots/screenshot1.png)
## Data Extraction
This is done by `scraper.ts`
## Webapp Deployment
1. `npm install`
2. `npm start` or `pm2 start npm -- start` (to daemonize with pm2)
3. Deploys on `localhost:8080`.

Change port with the `PORT` environment variable. Example: `PORT=8081 npm start`
