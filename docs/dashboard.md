# Dashboard (SPA)

Last verified against code: 2026-07-18 (M10).

## Routes

| Path                | Purpose                                               |
| ------------------- | ----------------------------------------------------- |
| `/`                 | Pipeline board, action-required, recent changes       |
| `/applications`     | Search / filter / sort table                          |
| `/applications/:id` | Timeline + evidence viewer                            |
| `/companies`        | Resolved companies (merge/split = M11)                |
| `/stats`            | Metrics + **small-sample guard** (n&lt;10 → n/N)      |
| `/settings`         | Gmail/classifier stubs (analytics sites deferred M14) |

Review queue UI is **M11** (API already exists from M8).

## Demo mode

Offline fixtures so the UI is navigable without Postgres:

```bash
# query param
open http://localhost:5173/?demo=1

# or build-time
VITE_DEMO=1 pnpm --filter @apptrack/web build
```

## Stack

TanStack Router + TanStack Query, Tailwind (IBM Plex), typed `src/api/client.ts`.

## Evidence viewer

Sandboxed iframe (`sandbox=""`) for sanitized HTML — T4. Classification evidence listed above the body.

## API (server)

| Method | Path                                                          |
| ------ | ------------------------------------------------------------- |
| GET    | `/api/v1/me`                                                  |
| GET    | `/api/v1/stats`                                               |
| GET    | `/api/v1/companies`                                           |
| GET    | `/api/v1/emails/:id/evidence`                                 |
| GET    | `/api/v1/applications` (owner fallback when `userId` omitted) |

## Tests

```bash
pnpm --filter @apptrack/web test
pnpm --filter @apptrack/web build
pnpm --filter @apptrack/web e2e   # Playwright demo smoke
```
