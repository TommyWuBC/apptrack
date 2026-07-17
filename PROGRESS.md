# PROGRESS — apptrack (agent-facing)

Short technical status. **Not** user-facing — see `DEVLOG.md` for tutorials.
Update this file every session. Pair with `HANDOFF.md` + `AGENTS.md`.

**Legend:** ✅ done · ⚠️ partial / blocked · ❌ missing · 🐛 known issue

---

## Milestone status (AGENTS.md §28)

| ID | Name | Status | Notes |
|----|------|--------|-------|
| M0 | Blueprint | ✅ | `AGENTS.md` v1.0.0 |
| M1 | Repository foundation | ✅ | Monorepo, CI, boundaries, hello API |
| M2 | Database & domain model | ⚠️ | Code done; live migrate/integration still needs Docker |
| M3 | Synthetic fixtures | ✅ | 69 `.eml`+expected; generator; eval stub (F1=0) |
| M4 | Gmail OAuth | ✅ | PKCE + encrypt store + refresh/`reauth_required` + docs; nock tests |
| M5–M20 | Rest | ❌ | Next: M5 incremental Gmail sync |

**Next:** M5 Incremental Gmail sync (uses M4 credentials + M3 fixtures via mock).

---

## What exists (code)

### Tooling / repo
- ✅ pnpm/turbo/eslint/prettier/depcruise/CI (+ `test:fixtures`, `eval` steps)
- ✅ Docker compose / Dockerfile / `.env.example`
- ✅ ADRs 001–004, 009
- ✅ `scripts/dev.ts`, `generate-fixtures.ts`, `run-eval.ts`
- ✅ `docs/gmail-oauth.md`

### packages/shared
- ✅ enums, ExtractionV1, ClassificationResultV1, errors (`REAUTH_REQUIRED`)
- ✅ `FixtureExpectedV1Schema`, `GoldenBaselineV1Schema`

### packages/core
- ✅ normalize + crypto
- ❌ classification / matching / … (M6–M8+)

### packages/db
- ✅ schema (26 tables), migration `0000_organic_electro.sql`, key repos, uuidv7
- ✅ `oauthCredentialsRepo.listAccountIdsExpiringBefore` (refresh sweep)
- ⚠️ integration tests skip without Postgres

### packages/providers
- ✅ `EmailProvider` types
- ✅ `gmail/oauth.ts` — PKCE, token exchange/refresh/revoke, userinfo (fetch; no googleapis yet)
- ❌ gmail sync adapter / mock / fixtures adapters (M5)

### fixtures/
- ✅ `emails/` — 69 synthetic pairs; `golden/` stub baseline

### apps/*
- ✅ server: hello/healthz/readyz + Gmail OAuth routes
- ✅ `oauthRefreshSweep` helper (worker cron wiring later)
- ❌ auth sessions UI / domain routes beyond Gmail connect

---

## Open issues / blockers

| # | Severity | Issue | Remediation |
|---|----------|-------|-------------|
| 1 | 🐛 M2/M4 proof | Docker not running | Start Docker → migrate → db + gmail integration tests |
| 2 | ⚠️ | Eval F1 always 0 | Expected until M7 |
| 3 | ⚠️ | `readyz` boss:false | Until pg-boss (M5+) |
| 4 | ❌ | No CI Postgres | Add service container later |

---

## Commands

```bash
pnpm fixtures:generate
pnpm test:fixtures
pnpm eval
pnpm typecheck && pnpm lint && pnpm test && pnpm boundaries
```

---

## Session log

### 2026-07-17 (M4)
- Gmail OAuth: PKCE store, encrypt→oauth repo, connect/callback/disconnect/refresh.
- `invalid_grant` → `reauth_required`; INV-4 grep tests; nock oauth unit tests.
- Docs: `docs/gmail-oauth.md`, ADR-004.
- Verified suite green; pushed to GitHub.

### 2026-07-17 (later)
- M3: generator, 69 fixtures, golden/eval stub, fixture vitest, CI steps.

### 2026-07-17
- M1+M2 scaffold; PROGRESS/DEVLOG split; Docker blocked for live DB.
