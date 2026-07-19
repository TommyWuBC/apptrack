# apptrack

Self-hostable, privacy-conscious job application tracker. Analyzes your own email to maintain an auditable internship/new-grad/full-time pipeline — confirmations, OAs, interviews, rejections, offers, ghosting — with confidence scores, evidence, and human corrections that automation never overwrites.

> Working name; rename before open-source release (D-9).

## Status

**M1–M15 implemented**, plus a stabilization pass (auth/sessions/CSRF, pg-boss jobs, analytics session fixes, review/reprocess completion, CI/deps). **Next: M16 Correlation.** See `AGENTS.md`, `HANDOFF.md`, and `PROGRESS.md`.

## Quickstart

```bash
cp .env.example .env
# set APP_ENCRYPTION_KEY, SESSION_SECRET, INTERNAL_JOB_SECRET
pnpm install
pnpm migrate
pnpm demo   # optional synthetic owner + applications
pnpm dev
```

- Dashboard: http://localhost:5173 (first run → `/setup`)
- API health: http://localhost:3000/healthz · readiness: `/readyz`
- Docs: [`docs/setup.md`](docs/setup.md)

## Architecture (one glance)

```
apps/web     ──► packages/shared (types) + REST only
apps/server  ──► packages/core / db / providers / shared
apps/worker  ──► packages/db / shared  (pg-boss → server internal API)
apps/cli     ──► packages/db / shared  (+ pg-boss enqueue)
```

Enforced by dependency-cruiser in CI. Details: `AGENTS.md` §8–§9, `ARCHITECTURE.md`.

## License

TBD (D-9 — MIT leaning).
