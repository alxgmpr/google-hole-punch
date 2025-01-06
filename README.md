# Google Hole Punch

Punch holes in your Cloudflare firewalls by scraping Google egress IPs and storing them in a group.

This assumes that you have created a Cloudflare Access rule that allows traffic from a specific group of IPs. This worker will update that group with the latest Google egress IPs.

IP addresses are scraped from https://www.gstatic.com/ipranges/goog.json

## Usage

- install dependencies: `npm i`
- generate a Cloudflare API token with the following permissions to the account where the CF Access rules are stored/referenced.
  - `Access: Organizations, Identity Providers` and `Groups:Edit`
- set `CLOUDFLARE_API_TOKEN` environment variable to the token value
  - set in `.dev.vars` for local development or
  - in production: `npx wrangler secret put CLOUDFLARE_API_TOKEN`
- update `ACCESS_GROUP_ID` and `CLOUDFLARE_ACCOUNT_ID` in `wrangler.toml`

## Running

When deployed, the worker runs on a cron schedule set in `wrangler.toml`. The scraper runs daily at midnight.

To test locally, run `npm run dev` and then ping `curl "http://localhost:8787/__scheduled?cron=0+0+*+*+*"`
