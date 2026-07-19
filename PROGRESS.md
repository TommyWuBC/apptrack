# PROGRESS — apptrack (agent-facing)

Short technical status. **Not** user-facing — see `DEVLOG.md` for tutorials.
Update this file every session. Pair with `HANDOFF.md` + `AGENTS.md`.

**Legend:** ✅ done · ⚠️ partial / blocked · ❌ missing · 🐛 known issue

---

## Milestone status (AGENTS.md §28)

| ID | Name | Status | Notes |
|----|------|--------|-------|
| M0–M1 | Blueprint / foundation | ✅ | |
| M2 | Database & domain model | ⚠️ | Code done; live migrate needs Docker |
| M3 | Synthetic fixtures | ✅ | 69 fixtures |
| M4 | Gmail OAuth | ✅ | |
| M5 | Incremental Gmail sync | ✅ | |
| M6 | Email normalization | ✅ | `norm-2026.07.0` |
| M7 | Deterministic classification | ✅ | `clf-2026.07.0` |
| M8 | Application matching | ✅ | `match-v1` |
| M9 | Timeline & state machine | ✅ | `state-v1` |
| M10 | Dashboard | ✅ | SPA + demo mode + Playwright smoke |
| M11–M20 | Rest | ❌ | **Next: M11 corrections & review** |

**Remaining after M10:** M11–M20 = **10 milestones**.

---

## Session log

### 2026-07-18 (M10)
- Dashboard SPA; stats/evidence APIs; demo fixtures; M8–M10 tests green; e2e smoke.

### 2026-07-18 (M8–M9)
- Matching + event-sourced reducer/timeline API.
