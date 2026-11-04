# Screen & Deep Dive 12 "Triage"

**Version 12.19** (4 November 2026)

An offline stock-research app for Indian listed companies. It reads Screener.in Excel exports, classifies each company by its NSE industry, values it with a sector-specific engine, and gives a plain verdict for your holding period and return target.

**Use it:** <https://coolboss.github.io/screen-and-deep-dive/> (works on phones too), or download `index.html` and open it in Chrome, Edge, Safari or Firefox on a computer.

## What is in this repository

| File | What it is |
|---|---|
| `index.html` | The whole app. One file, no install, nothing leaves your browser except price downloads. |

## How it works, in short

1. **Get data** — statements come from a Screener.in Excel export or, as a second source, a Tijori Finance company export (cons_….xlsx); the app rewrites the latter into Screener's layout and runs the same engines (Fiem Industries from both sources: fair value within 1%). If you have no list yet, **Find companies** writes a Screener query for your goal (or pick one of 28 ready-made screens; field names are checked against Screener's own ratio list). Then export each company from Screener.in with its Export to Excel button, and drop the files in together.
2. **Screen** — a quick pre-screen grades the batch; the investment-grade scan runs the full valuation and sorts companies into act now / wait / too expensive.
3. **Deep dive** — one company: verdict, three reasons for and against, fair-value range, action plan with entry prices, daily chart and a weekly "second opinion" from prices.

Prices are fetched from a free public NSE dataset; everything else works offline. Because that dataset sometimes runs a few days late, a small job in this repository (`.github/workflows/update-prices.yml`) downloads NSE's own end-of-day file every weekday evening and keeps the last 15 trading days in `data/recent.json`. The app uses it to fill any missing recent days. Holdings you import (Zerodha, HDFC Securities or any broker file) stay in your browser.

## Privacy

No server, no account, no tracking. The only network calls are the price downloads (GitHub raw / jsDelivr / Statically). Holdings, notes and settings live in your browser's local storage.

## Disclaimer

This is a research aid, not investment advice. The model is deliberately conservative and sees only what the statements show. Read the news and the latest results before you act.
