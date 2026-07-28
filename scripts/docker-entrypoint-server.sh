#!/usr/bin/env sh
# Production server entrypoint: migrate then serve. AGENTS.md §27 / M20
set -eu
echo "Running database migrations…" >&2
pnpm --filter @apptrack/db migrate
echo "Starting API server…" >&2
exec node apps/server/dist/index.js
