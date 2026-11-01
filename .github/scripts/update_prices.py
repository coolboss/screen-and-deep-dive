"""Nightly NSE price top-up for Screen & Deep Dive.

The app's main price source (the public eod2_data repository) sometimes lags by
several days. This script downloads NSE's own end-of-day file for each recent
trading day and keeps the last KEEP_DAYS days in data/recent.json, which the app
uses to fill the gap.

File format:
  {"updated": "2026-11-01T19:00:00+05:30",
   "days": [{"date": "2026-10-30", "p": {"INFY": [open, close, volume, delivery_qty], ...}}, ...]}

Standard library only, so the GitHub Action needs no installs.
"""
import csv
import io
import json
import os
import sys
import time
import urllib.error
import urllib.request
import zipfile
from datetime import date, datetime, timedelta, timezone

IST = timezone(timedelta(hours=5, minutes=30))
OUT = os.path.join(os.path.dirname(__file__), "..", "..", "data", "recent.json")
KEEP_DAYS = 15          # trading days kept in the file
LOOKBACK = 21           # calendar days checked when the file is new
SERIES = {"EQ", "BE", "BZ"}
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/130.0 Safari/537.36",
    "Accept": "*/*",
    "Referer": "https://www.nseindia.com/",
}


class Holiday(Exception):
    pass


def get(url):
    req = urllib.request.Request(url, headers=HEADERS)
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=40) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 404:
                raise Holiday(url)
            last = e
        except Exception as e:  # timeouts, resets
            last = e
        time.sleep(4 * (attempt + 1))
    raise last


def num(x):
    try:
        return float(str(x).strip().replace(",", ""))
    except ValueError:
        return None


def from_full_bhav(d):
    """sec_bhavdata_full: has open, close, volume and delivery quantity."""
    url = f"https://nsearchives.nseindia.com/products/content/sec_bhavdata_full_{d:%d%m%Y}.csv"
    text = get(url).decode("utf-8", "replace")
    rows = csv.DictReader(io.StringIO(text), skipinitialspace=True)
    out = {}
    for r in rows:
        r = {k.strip(): (v or "").strip() for k, v in r.items() if k}
        if r.get("SERIES") not in SERIES:
            continue
        o, c, v = num(r.get("OPEN_PRICE")), num(r.get("CLOSE_PRICE")), num(r.get("TTL_TRD_QNTY"))
        q = num(r.get("DELIV_QTY"))
        if c and c > 0:
            out[r["SYMBOL"]] = [o, c, int(v) if v is not None else None, int(q) if q is not None else None]
    return out


def from_udiff(d):
    """Fallback: the newer bhavcopy zip (no delivery data)."""
    url = f"https://nsearchives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_{d:%Y%m%d}_F_0000.csv.zip"
    z = zipfile.ZipFile(io.BytesIO(get(url)))
    text = z.read(z.namelist()[0]).decode("utf-8", "replace")
    out = {}
    for r in csv.DictReader(io.StringIO(text)):
        if r.get("SctySrs", "").strip() not in SERIES:
            continue
        o, c, v = num(r.get("OpnPric")), num(r.get("ClsPric")), num(r.get("TtlTradgVol"))
        if c and c > 0:
            out[r["TckrSymb"].strip()] = [o, c, int(v) if v is not None else None, None]
    return out


def fetch_day(d):
    try:
        return from_full_bhav(d)
    except Holiday:
        pass  # might still exist in the other format; check before calling it a holiday
    except Exception as e:
        print(f"  full bhavcopy failed for {d}: {e}", file=sys.stderr)
    return from_udiff(d)


def main():
    now = datetime.now(IST)
    try:
        with open(OUT) as f:
            data = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        data = {"days": []}
    have = {x["date"] for x in data["days"]}

    start = now.date() - timedelta(days=LOOKBACK)
    if data["days"]:
        start = max(start, date.fromisoformat(max(have)) + timedelta(days=1))
    # Today's file appears around 6 pm IST; skip today if it is earlier than that.
    end = now.date() if now.hour >= 18 else now.date() - timedelta(days=1)

    added, errors = 0, []
    d = start
    while d <= end:
        if d.weekday() < 5 and d.isoformat() not in have:
            try:
                p = fetch_day(d)
                if len(p) < 500:
                    raise RuntimeError(f"only {len(p)} symbols")
                data["days"].append({"date": d.isoformat(), "p": p})
                added += 1
                print(f"{d}: {len(p)} symbols")
            except Holiday:
                print(f"{d}: no file (market holiday)")
            except Exception as e:
                errors.append(f"{d}: {e}")
                print(f"{d}: FAILED {e}", file=sys.stderr)
        d += timedelta(days=1)

    data["days"] = sorted(data["days"], key=lambda x: x["date"])[-KEEP_DAYS:]
    if added:
        data["updated"] = now.isoformat(timespec="seconds")
        os.makedirs(os.path.dirname(OUT), exist_ok=True)
        with open(OUT, "w") as f:
            json.dump(data, f, separators=(",", ":"))
        print(f"Saved {added} new day(s); file holds {len(data['days'])} days.")
    else:
        print("Nothing new.")
    if errors and not added:
        # Every attempt failed: make the run show red so it is noticed.
        sys.exit("Could not download from NSE:\n" + "\n".join(errors))


if __name__ == "__main__":
    main()
