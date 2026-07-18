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
| M7 | Deterministic classification | ✅ | `clf-2026.07.0`; golden F1≈0.97 |
| M8 | Application matching | ✅ | `match-v1` (PR #1) |
| M9 | Timeline & state machine | ✅ | `state-v1` reducer + timeline API |
| M10–M20 | Rest | ❌ | **Next: M10 Dashboard** |

**Remaining after M9:** M10–M20 = **11 milestones**.

---

## What exists (code)

### packages/core
- ✅ crypto, normalize, classify L1+L2, matching, resolution
- ✅ **statemachine** (`state-v1` reduce + corrections stub)

### packages/db
- ✅ applications repos + projection touch helpers

### apps/server
- ✅ sync → normalize → classify → match → **recompute**
- ✅ `/api/v1/applications/*` + timeline + recompute

---

## Session log

### 2026-07-18 (M9)
- Pure reducer, recompute service, timeline API; match uses recompute; gate green.

### 2026-07-18 (M8)
- Matcher + resolution + review queue; docs; gate green.

### 2026-07-17 (M5–M7)
- Sync, normalize, deterministic classification.
