# v1.0.0 acceptance

Last verified against code: 2026-07-29 (M20).

This tracks AGENTS.md §37. Items that need the owner's live mailbox or a
production VPS are marked **owner** — the open-source bar is §37.2 with mock
provider + synthetic fixtures.

## §37.2 Open-source release (v1.0.0)

| #   | Criterion                                                     | Status        | Evidence                                                                 |
| --- | ------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------ |
| 1   | Fresh machine: clone → `.env` → `docker compose up` demo path | ✅ documented | README + server migrate entrypoint; `EMAIL_PROVIDER=mock`                |
| 2   | Full pipeline with mock provider; no Google required          | ✅            | `EMAIL_PROVIDER=mock`, fixtures, `pnpm demo`                             |
| 3   | §33 docs exist; PRIVACY reflects code                         | ✅            | PRIVACY.md, THREAT_MODEL, setup, ADRs, interview-prep                    |
| 4   | M17 security checklist; gitleaks + prod audit                 | ✅            | THREAT_MODEL T1–T14; CI gitleaks; `pnpm audit --prod --audit-level=high` |
| 5   | Golden eval in README with caveats                            | ✅            | F1≈0.972 table + synthetic caveat                                        |
| 6   | License, CoC, CONTRIBUTING, templates, release automation     | ✅            | MIT, workflows/release.yml → GHCR                                        |

## §37.1 Owner dogfooding (post-release)

| #   | Criterion                             | Status                                           |
| --- | ------------------------------------- | ------------------------------------------------ |
| 1   | Real Gmail connect + 7-day sync       | ⏳ owner                                         |
| 2   | ≥90% confirmation attach on real mail | ⏳ owner                                         |
| 3   | Timeline evidence usable              | ✅ in mock/demo                                  |
| 4   | Correction survives reprocess (INV-7) | ✅ unit/adversarial tests; ⏳ owner on real data |
| 5   | Ghost flag/dismiss/reverse            | ✅ tests; ⏳ owner                               |
| 6   | Export complete                       | ✅ CLI `apptrack export`                         |
| 7   | No plaintext tokens in dump/logs      | ✅ INV-1/4 + redact tests; ⏳ owner dump inspect |

## Automated verification (agent run)

```text
pnpm typecheck   # green
pnpm lint        # green
pnpm test        # green
pnpm eval        # F1≈0.972
pnpm boundaries  # green
pnpm audit --prod --audit-level=high  # no known vulns
```

## Backup / restore rehearsal

Documented in `docs/setup.md`. Manual ops checklist:

1. `age-keygen -o age-key.txt`
2. `BACKUP_AGE_RECIPIENT=… ./scripts/backup.sh ./backups`
3. Restore into a disposable DB with `./scripts/restore.sh`

## Tag recipe (human)

```bash
git tag -a v1.0.0 -m "apptrack v1.0.0"
git push origin v1.0.0   # triggers .github/workflows/release.yml
```
