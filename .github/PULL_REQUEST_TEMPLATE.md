## Summary

<!-- What does this PR do and why? Link issue / milestone (M1–M20) if applicable. -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change (ADR + version bump required)
- [ ] Documentation only
- [ ] Refactor / chore

## Checklist

- [ ] `pnpm typecheck && pnpm lint && pnpm test` pass locally
- [ ] `pnpm boundaries` passes (no forbidden cross-package imports)
- [ ] Tests added or updated for behavior changes (R-5)
- [ ] **Invariants (INV-*)** reviewed — list any touched: <!-- e.g. INV-7 corrections -->
- [ ] **No secrets** — no `.env`, tokens, real emails, or personal data (R-9, R-10)
- [ ] **Docs** updated if user-facing behavior, config, or data flows changed
- [ ] **Classification/matching:** `pnpm eval` run; baseline delta noted below if intentional
- [ ] **Migrations:** backward-compatible; `migrate` / `migrate:down` tested if schema changed
- [ ] **Version strings** bumped if normalize/classify/match/reducer behavior changed (R-8)

## Eval / metrics (if applicable)

<!-- Paste eval summary or "N/A". -->

## Screenshots / demo

<!-- For UI changes. Use demo mode only — no real mailbox data. -->

## ADR / DEVLOG

- [ ] ADR required and linked: <!-- docs/adr/NNNN-... -->
- [ ] DEVLOG entry appended (required for merged behavior changes per AGENTS.md §32)
