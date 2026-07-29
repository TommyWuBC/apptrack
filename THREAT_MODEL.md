# Threat model — apptrack

Last verified against code: 2026-07-28 (M17).

This expands AGENTS.md §6.2. Every row lists automated tests and/or documented
manual verification. Acceptance (M17): each T1–T14 row has coverage.

## Trust boundaries

| Zone         | Examples                                                                                             |
| ------------ | ---------------------------------------------------------------------------------------------------- |
| Untrusted    | Email bodies/subjects/headers/attachments/links; analytics payloads; public query params; LLM output |
| Semi-trusted | Gmail API responses (authenticated; treat as data)                                                   |
| Trusted      | Env config; this repo; authenticated owner inputs (still zod-validated)                              |

## Threat register

| ID      | Threat                                   | Mitigation                                                                                                | Verification                                                                                                                                                                            |
| ------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **T1**  | Database compromise exposes OAuth tokens | AES-256-GCM at rest; key only in env (`APP_ENCRYPTION_KEY`); dedicated oauth repo                         | Automated: `packages/db` INV-1 schema + repo reject plaintext; `packages/core/crypto` round-trip + tamper. Manual: inspect `pg_dump` — token columns are bytea, not readable strings.   |
| **T2**  | OAuth token theft via API/logs           | INV-4: never serialize tokens; logger redact paths; `gmail.readonly` scope                                | Automated: `apps/server/src/inv4-gmail.test.ts`; gmail callback nock test asserts no plaintext in JSON; `LOG_REDACT_PATHS` includes token fields.                                       |
| **T3**  | Session hijacking                        | httpOnly + Secure(prod) + SameSite=Lax; argon2id; session hash at rest; absolute + idle expiry            | Automated: `auth/security.test.ts` (argon2id, hash); auth gate tests (401/503 without session); CSRF integration (session cookie required). Manual: DevTools — session cookie HttpOnly. |
| **T4**  | XSS via email HTML                       | `sanitize-html` allowlist on ingest; EvidenceViewer `sandbox=""` iframe; app CSP `frame-ancestors 'none'` | Automated: XSS snapshot in `email-normalize.test.ts`; security-suite headers + EvidenceViewer source contract; CSP unit test.                                                           |
| **T5**  | CSRF                                     | Double-submit `X-CSRF-Token` + signed cookie; analytics exempt (keyed)                                    | Automated: `auth/security.test.ts` CSRF bind; `auth-csrf.integration.test.ts` (mutation without header → 403); auth plugin source contract.                                             |
| **T6**  | Prompt injection in email                | Email is DATA; LLM no tools; zod allowlist; canary fixtures                                               | Automated: classify canary tests; fixtures `_edge/.../prompt-injection-*`; LLM output schema validation path.                                                                           |
| **T7**  | SSRF via extracted links                 | INV-6: never fetch email/analytics URLs                                                                   | Automated: normalize marks tracking links without fetch; grep/contract — no fetcher of stored URLs in server/worker. Manual: code review of any new HTTP client.                        |
| **T8**  | Insecure model-provider logging          | Deterministic/local modes; OpenAI `store: false`; docs disclosure                                         | Automated: `llm/adapters.test.ts` asserts `store: false`. Manual: PRIVACY.md / settings egress copy (M13+).                                                                             |
| **T9**  | Analytics abuse                          | Site key; origin allowlist; zod caps; per-key + per-source + global API rate limits; retention            | Automated: analytics schema + rate limiter tests; security-suite global 429; ingest service limits.                                                                                     |
| **T10** | Secrets in Git                           | `.env` gitignored; `.env.example` placeholders; gitleaks CI                                               | Automated: CI gitleaks job. Manual: never commit `.env`.                                                                                                                                |
| **T11** | Logs leak email content                  | Pino redact paths for subject/body/addresses/tokens; debug gated                                          | Automated: `logger-redact` + security-suite scrub test; app wires `LOG_REDACT_PATHS`.                                                                                                   |
| **T12** | Backup leakage                           | `scripts/backup.sh` → `pg_dump \| age`; restore decrypts with identity                                    | Automated: scripts present + setup docs. Manual: run backup/restore rehearsal on a disposable DB (ops checklist).                                                                       |
| **T13** | Dependency compromise                    | Lockfile committed; Dependabot; CI `pnpm audit`                                                           | Automated: `.github/dependabot.yml`; CI audit step (high+). Manual: review Dependabot PRs.                                                                                              |
| **T14** | Malicious attachments                    | Metadata only (filename/mime/size/hash); `.ics` text parse only                                           | Automated: schema invariant — no attachment body column; normalizer ICS path.                                                                                                           |

## Invariants crosswalk

| INV   | Maps to                                 |
| ----- | --------------------------------------- |
| INV-1 | T1                                      |
| INV-2 | (integrity; see jobs/idempotency tests) |
| INV-3 | T9 + all route zod                      |
| INV-4 | T2                                      |
| INV-5 | T6 (no CoT persistence)                 |
| INV-6 | T7                                      |
| INV-7 | corrections adversarial tests (M11)     |
| INV-8 | analytics schema invariants             |
| INV-9 | application_events append-only          |

## Residual risk / operator notes

- Self-hosters must keep `APP_ENCRYPTION_KEY`, `SESSION_SECRET`, and age backup identities offline and backed up separately.
- Gmail OAuth in Google “Testing” mode expires refresh tokens ~7 days — ops/docs cover publishing the consent screen.
- Correlation copy must stay probabilistic (banned-phrase tests); never claim recruiter identification.
- Global API rate limit is in-memory per process — fine at NFR-1; multi-replica deployments share no bucket (acceptable for v1 single-node Compose).
