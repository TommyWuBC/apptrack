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
| M14 | Analytics ingestion | ✅ | sites + ingest + aggregate |
| M15 | Analytics SDK + example | ✅ | `/sdk.js`, Astro example, e2e |
| M16–M20 | Rest | ❌ | **Next: M16 Correlation** |

**Remaining after M15:** M16–M20 = **5 milestones**.

---

## Session log

### 2026-07-19 (M15)
- Browser SDK &lt;2KB gz; `GET /sdk.js`; `examples/website-astro`; Playwright SDK e2e; docs.

### 2026-07-19 (M14)
- Analytics ingest/sessionize/retention; sites settings UI; INV-8 expanded; load script.

### 2026-07-19 (M13)
- L3 LLM extraction + egress settings.

### 2026-07-19 (M12 / M11)
- Ghosting; corrections/review.
