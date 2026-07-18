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
| M8 | Application matching | ✅ | `match-v1`; review queue; reevaluate |
| M9–M20 | Rest | ❌ | **Next: M9 timeline & state machine** |

---

## What exists (code)

### packages/core
- ✅ crypto, L0, normalize, classify L1+L2
- ✅ **matching** (`match-v1` signals/thresholds) + **resolution** (aliases, Jaro-Winkler, role norm)

### packages/db
- ✅ match candidates / review queue / company alias / role repos

### apps/server
- ✅ sync → normalize → classify → match
- ✅ `/api/v1/match/*`, `/api/v1/review`

### eval
- ✅ `pnpm eval` (unchanged this milestone)

---

## Session log

### 2026-07-18 (M8)
- Matcher + resolution + match service/routes; wired into sync; docs; gate green.

### 2026-07-17 (M7)
- Deterministic classifier; eval F1 0.972; M5–M7 gate green; pushed.

### 2026-07-17 (M5–M6)
- Sync + normalize pipelines.

### 2026-07-17 (earlier)
- M1–M4 scaffold/OAuth/fixtures.
