# Screen & Deep Dive 12 "Triage"

**Version 12.13** (2 November 2026) · Batch export script version 12.5

An offline stock-research app for Indian listed companies. It reads Screener.in Excel exports, classifies each company by its NSE industry, values it with a sector-specific engine, and gives a plain verdict for your holding period and return target.

**Use it:** <https://coolboss.github.io/screen-and-deep-dive/> (works on phones too), or download `index.html` and open it in Chrome, Edge, Safari or Firefox on a computer.

## What is in this repository

| File | What it is |
|---|---|
| `index.html` | The whole app. One file, no install, nothing leaves your browser except price downloads. |
| `Screener_batch_export.user.js` | Userscript that adds a "Batch export" button on screener.in. On a computer the same exporter is built into the app as a bookmark. On a phone this script is the way: iPhone/iPad with the Userscripts app for Safari (tested), Android with Firefox + Tampermonkey. Steps are on the app's Get data page. |

## How it works, in short

1. **Get data** — if you have no list yet, **Find companies** writes a Screener query for your goal (or pick one of 28 ready-made screens; field names are checked against Screener's own ratio list). Then export companies from Screener.in (the app's bookmark does a whole list at once and packs them in a zip with a notes file per company: Screener's pros and cons, shareholding, announcements).
2. **Screen** — a quick pre-screen grades the batch; the investment-grade scan runs the full valuation and sorts companies into act now / wait / too expensive.
3. **Deep dive** — one company: verdict, three reasons for and against, fair-value range, action plan with entry prices, daily chart and a weekly "second opinion" from prices.

Prices are fetched from a free public NSE dataset; everything else works offline. Because that dataset sometimes runs a few days late, a small job in this repository (`.github/workflows/update-prices.yml`) downloads NSE's own end-of-day file every weekday evening and keeps the last 15 trading days in `data/recent.json`. The app uses it to fill any missing recent days. Holdings you import (Zerodha, HDFC Securities or any broker file) stay in your browser.

## Privacy

No server, no account, no tracking. The only network calls are the price downloads (GitHub raw / jsDelivr / Statically). Holdings, notes and settings live in your browser's local storage.

## Disclaimer

This is a research aid, not investment advice. The model is deliberately conservative and sees only what the statements show. Read the news and the latest results before you act.
