# PROGRESS — apptrack (agent-facing)

Short technical status. **Not** user-facing — see `DEVLOG.md` for tutorials.

**Legend:** ✅ done · ⚠️ partial / blocked · ❌ missing · 🐛 known issue

---

## Milestone status (AGENTS.md §28)

| ID | Name | Status | Notes |
|----|------|--------|-------|
| M0–M7 | Foundation → classification | ✅ | |
| M8 | Application matching | ✅ | |
| M9 | Timeline & state machine | ✅ | |
| M10 | Dashboard | ✅ | |
| M11 | Corrections & review | ✅ | |
| M12 | Ghosting | ✅ | |
| M13 | Optional LLM extraction | ✅ | |
| M14 | Analytics ingestion | ✅ | |
| M15 | Analytics SDK + example | ✅ | |
| M16 | Correlation scoring | ✅ | |
| M17 | Security hardening | ✅ | THREAT_MODEL, headers, backups, audit |
| M18 | Open-source packaging | ✅ | MIT, CoC, CONTRIBUTING, release.yml, D-9 |
| M19 | Documentation & demo | ✅ | README, PRIVACY, interview-prep, storyboard |
| M20 | Release prep | ✅ | v1.0.0 acceptance, migrate entrypoint, packaging tests |

**v1.0.0:** ✅ code + docs bar for §37.2. **§37.1** live-Gmail dogfooding = owner follow-up.

---

## Session log

### 2026-07-29 (M18–M20 / v1.0.0)
- Packaging: LICENSE MIT, CONTRIBUTING, CoC, PRIVACY, CHANGELOG, ADRs, GH templates, release→GHCR.
- Docs: README eval table, interview-prep, data-retention, demo storyboard, v1-acceptance.
- Ops: Docker server migrate entrypoint; `pnpm test:packaging`; version `1.0.0`.

### 2026-07-28 (M17)
- Security headers, rate limits, redact paths, §24.8 suite, age backups, Dependabot, prod audit.

### 2026-07-19 (M16)
- `corr-v1`, unique links, tracked résumé, banned-phrase tests.
