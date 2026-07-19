# Correlation model (`corr-v1`)

Last verified against code: 2026-07-19 (M16).

Correlation estimates whether an **anonymous** portfolio analytics session might relate to a tracked application. It is inference, never identification. Feature flag: `CORRELATION_ENABLED` (default `false`).

## When it runs

1. Analytics `aggregate` finishes and returns new/updated `sessionIds`.
2. If correlation is enabled, the server enqueues `correlation.score` (pg-boss) with those session ids.
3. Manual/internal: `POST /api/v1/correlation/score` (session cookie or internal job header).

Rescoring on algorithm bump inserts new rows keyed by `(application_id, session_id, algorithm_version)`.

## Deterministic path (unique links)

Per-application opt-in tokens (8-char base58-ish):

| Surface        | URL                                                                |
| -------------- | ------------------------------------------------------------------ |
| Portfolio      | `{PORTFOLIO_BASE_URL}/?src=<token>` (falls back to `APP_BASE_URL`) |
| Tracked résumé | `GET /r/<token>/resume.pdf` (public)                               |

If any session event carries `srcToken` matching the application’s `unique_link_token`:

- `score = 1.0`, `deterministic = true`, band **`high`**
- Explanation: visit used this application’s unique link (estimated association)

Tracked résumé downloads log a `resume_download` analytics event with that `srcToken` (no IP stored). Upload the PDF via `POST /api/v1/resume` first.

Mint: `POST /api/v1/links` · Revoke: `DELETE /api/v1/links/:applicationId`.

## Probabilistic path

Weighted features (see `packages/core/src/correlation/score.ts`):

| Feature                                                            | Points (start) |
| ------------------------------------------------------------------ | -------------- |
| Visit timing vs pipeline event (interview strongest; decays 3→14d) | up to +0.25    |
| Geo city matches company office/HQ                                 | +0.25          |
| Geo region match only                                              | +0.12          |
| Referrer LinkedIn / ATS host                                       | +0.10          |
| Résumé view/download (non-token)                                   | +0.15          |
| Project page views                                                 | +0.05          |
| Repeat visitor_hash same UTC day                                   | +0.05          |
| Business hours in company TZ                                       | +0.05          |

Ambiguity: divide raw score by `√k` where `k` = active applications sharing the matched metro.

Bands: `<0.30` none (not stored) · `0.30–0.55` low · `>0.55` medium. **Probabilistic scores never reach `high`.**

## Language constraints

Stored explanations and UI copy must not claim identification. Banned substrings (tested): `recruiter viewed`, `visited by`, `definitely`, `confirmed` (except the user’s feedback enum value). Allowed framing: “anonymous visit potentially associated”, “estimated association”, “possible application-related visit”.

## Feedback

`POST /api/v1/correlations/:id/feedback` with `{ feedback: "confirmed" | "rejected" }` stores labels for a possible future local model (D-6). Does not change the score row’s explanation text.

## Privacy notes

- No visitor IPs at rest (INV-8).
- Correlation never fetches URLs from email or analytics (INV-6).
- Unique links are opt-in per application; disclose on the portfolio if you use them.
