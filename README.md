# apptrack

Self-hostable, privacy-conscious job application tracker. Analyzes your own email to maintain an auditable internship/new-grad/full-time pipeline — confirmations, OAs, interviews, rejections, offers, ghosting — with confidence scores, evidence, and human corrections that automation never overwrites.

> Working name; rename before open-source release (D-9).

## Status

**Milestone M1** — repository foundation (in progress). See `AGENTS.md` for the full blueprint and `HANDOFF.md` for the current agent relay.

## Quickstart

```bash
cp .env.example .env
pnpm install
pnpm dev
```

- API hello: http://localhost:3000/api/v1/hello
- SPA shell: http://localhost:5173
- Docs: [`docs/setup.md`](docs/setup.md)

## Architecture (one glance)

```
apps/server  ──► packages/core ──► packages/shared
apps/worker  ──► packages/db   ──► packages/shared
apps/cli     ──► packages/providers ──► packages/shared
apps/web     ──► packages/shared (types) + REST only
```

Enforced by dependency-cruiser in CI. Details: `AGENTS.md` §8–§9.

## License

TBD (D-9 — MIT leaning).
