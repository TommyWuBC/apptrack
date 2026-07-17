# Golden dataset

Labeled fixtures for classifier accuracy measurement (AGENTS.md §24.5).

- `index.json` — paths into `fixtures/emails/**/*.expected.json` used for eval
- `baseline.json` — committed metrics; **CI will fail later (M7+) if F1 drops >2 points**

Until the deterministic classifier exists, `pnpm eval` writes **zeros** (stub predictions).

Do not commit real personal email. Extend only via synthetic generation or `apptrack fixtures:add --scrub` (later).
