# Demo GIF storyboard

Last verified against code: 2026-07-29 (M20).

README and release assets use short screen recordings of **demo mode** — never a real
mailbox. This document describes how to record those GIFs. Binary GIF files are not stored
in the repository; attach them to GitHub releases or host in README via uploaded assets.

## Prerequisites

```bash
cp .env.example .env
# Set APP_ENCRYPTION_KEY, SESSION_SECRET, INTERNAL_JOB_SECRET
pnpm install
docker compose -f docker-compose.dev.yml up -d
pnpm migrate
pnpm demo
pnpm dev
```

- `EMAIL_PROVIDER=mock` and `CLASSIFIER_MODE=deterministic` (defaults in `.env.example`).
- Demo data is synthetic (fictional companies, no real PII).

Open http://localhost:5173 and log in with the demo owner credentials printed by
`pnpm demo` (or create via `/setup` if you skipped demo).

## Recording tools

Any screen recorder that exports GIF or MP4:

- **Windows:** ScreenToGif, ShareX, Xbox Game Bar
- **macOS:** Kap, CleanShot X, QuickTime + convert
- **Linux:** Peek, SimpleScreenRecorder

Target: **1280×720** or **1920×1080**, 15–30 fps, **≤15 seconds** per clip, **≤5 MB** per
GIF when possible (use palette optimization in ScreenToGif or `ffmpeg`).

### Optional ffmpeg conversion

```bash
ffmpeg -i demo.mp4 -vf "fps=12,scale=1280:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" -loop 0 demo.gif
```

## Storyboard — recommended clips

### GIF 1: Pipeline overview (homepage)

**Goal:** Show the product at a glance.

1. Start on `/` pipeline board with demo applications in varied states.
2. Slowly scroll the action-required list and upcoming deadlines.
3. Hover one card to show company/state tooltip.
4. End on a state column with several cards visible.

**Caption for README:** "Your application pipeline, updated from email."

---

### GIF 2: Application timeline + evidence

**Goal:** Demonstrate explainability (FR-4).

1. Open `/applications` and click an application in `interviewing` or `assessment_received`.
2. Expand the timeline; click one email-backed event.
3. Open the evidence popover ("How was this inferred?").
4. Briefly show the sandboxed email viewer iframe (sanitized HTML).

**Caption:** "Every automated inference includes confidence and evidence."

---

### GIF 3: Review queue resolution

**Goal:** Human-in-the-loop without silent guesses.

1. Navigate to `/review`.
2. Open an `ambiguous_match` or `uncertain_classification` item.
3. Show top candidates with scores.
4. Resolve with one click (attach or dismiss).
5. Show the item disappear and a toast or list update.

**Caption:** "Uncertain matches go to review — nothing is silently dropped."

---

### GIF 4: Mock Gmail sync (contributor path)

**Goal:** Prove contributors need no Google account.

1. Open Settings → Gmail (or sync status).
2. Show `EMAIL_PROVIDER=mock` in terminal or settings copy.
3. Trigger manual sync (`POST /sync/run` via UI or `apptrack sync:run` in a terminal pane).
4. Return to applications list; highlight a newly appeared row.

**Caption:** "Full pipeline runs with `EMAIL_PROVIDER=mock` — no Gmail setup required."

---

### GIF 5: Privacy / deterministic mode (optional)

**Goal:** Recruiting story for privacy-conscious self-hosters.

1. Settings → classifier mode: show `deterministic` selected.
2. Point at disclosure text (no LLM egress).
3. Optional: toggle analytics site to `no_geo` and show visitor disclosure snippet.

**Caption:** "Deterministic classification by default; LLM egress is opt-in."

---

### GIF 6: Analytics + unique link (optional, M15–M16)

**Goal:** Cookie-free analytics and opt-in correlation.

1. Open `examples/website-astro` dev preview or deployed example with `sdk.js`.
2. Navigate pages; show network tab with `POST /api/v1/analytics/events` (no cookies).
3. Visit with `?src=<token>`; show correlation panel on application detail (medium band).

**Caption:** "Cookie-free analytics; correlation capped at medium unless you use a unique link."

## Checklist before publishing

- [ ] No real email addresses, company names from your actual job search, or OAuth screens with client secrets.
- [ ] Browser bookmarks and OS notifications hidden (Do Not Disturb).
- [ ] Consistent theme (light or dark — match README).
- [ ] GIF loops cleanly (avoid jarring jump cut).
- [ ] File names: `demo-pipeline.gif`, `demo-timeline.gif`, etc.

## Where to put files

1. Record to `docs/media/` locally (gitignored) or your desktop.
2. Upload to GitHub release assets for v1.0.0, or
3. Drag into README on github.com (creates `user-attachments` URLs).

Do **not** commit multi-megabyte binaries to git history.

## Regenerating demo data

```bash
pnpm demo   # re-seed synthetic owner + ~40 applications
```

If the database already has data, follow CLI help or reset the dev database volume before
re-seeding for a clean recording.

## Related

- [CONTRIBUTING.md](../CONTRIBUTING.md) — mock mode for contributors
- [docs/setup.md](./setup.md) — full setup
- AGENTS.md M19 — README screenshots from `pnpm demo`
