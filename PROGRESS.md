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
| M11 | Corrections & review | ✅ | INV-7 + review UI |
| M12 | Ghosting | ✅ | ghost-v1 + settings + dismiss |
| M13–M20 | Rest | ❌ | **Next: M13 LLM or M14 analytics** |

**Remaining after M12:** M13–M20 = **8 milestones**.

---

## Session log

### 2026-07-19 (M12)
- Core `evaluateGhost` / thresholds; `user_settings` migration; evaluate/dismiss/settings/notifications API; SPA badges + settings; Playwright ghost dismiss.

### 2026-07-19 (M11)
- Corrections/review/merge/split/reattach; SPA `/review` + corrections panel; tests green.

### 2026-07-18 (M8–M10)
- Matching, reducer/timeline, dashboard SPA.
