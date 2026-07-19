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
| M12 | Ghosting | ✅ | ghost-v1 |
| M13 | Optional LLM extraction | ✅ | L3 + adapters + egress UI |
| M14–M20 | Rest | ❌ | **Next: M14 analytics** |

**Remaining after M13:** M14–M20 = **7 milestones**.

---

## Session log

### 2026-07-19 (M13)
- LlmClient + 3 HTTP adapters; extract.v1; L3/arbitration; classifier settings + egress; canary/hybrid tests; eval baseline bump to clf-2026.07.1.

### 2026-07-19 (M12)
- Core `evaluateGhost` / thresholds; evaluate/dismiss/settings API; SPA badges.

### 2026-07-19 (M11)
- Corrections/review/merge/split; INV-7.

### 2026-07-18 (M8–M10)
- Matching, reducer/timeline, dashboard SPA.
