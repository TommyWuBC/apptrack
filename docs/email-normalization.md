# Email normalization

Last verified against code: 2026-07-17 (M6).

## What it does

Turns raw MIME (or subject/snippet fallback) into a stable, searchable representation:

| Field | Meaning |
|-------|---------|
| `text_plain` | Body with quotes/signatures stripped |
| `text_full` | Full extracted text (quotes kept) |
| `sanitized_html` | Allowlisted HTML (scripts/iframes stripped) |
| `links` | Extracted URLs; tracking hosts flagged; unwrap from query params only (**never fetched** — INV-6) |
| `calendar_event` | Parsed `.ics` / `text/calendar` when present |
| `normalizer_version` | e.g. `norm-2026.07.0` — bump on behavior change |

## Pipeline order

1. MIME parse (`mailparser`) when `rawMime` present  
2. HTML sanitize (`sanitize-html`)  
3. Text extraction (plain preferred, else HTML→text)  
4. Quote/signature strip → `text_plain`  
5. Link extract  
6. Calendar parse (`ical.js`)

## API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/normalize/version` | Current version string |
| POST | `/api/v1/normalize/:messageId` | Re-run normalize (idempotent per version) |

Sync (`POST /api/v1/sync/run`) normalizes newly inserted messages automatically when the provider returns MIME (mock fixtures) or body parts.
