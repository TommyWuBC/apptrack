#!/usr/bin/env bash
# Decrypt + restore an age-encrypted pg_dump. AGENTS.md §27 / T12
#
# Usage:
#   export DATABASE_URL=postgres://...
#   export BACKUP_AGE_IDENTITY=./key.txt   # age identity file
#   ./scripts/restore.sh ./backups/apptrack-….dump.age
#
# WARNING: overwrites the target database. Take a fresh backup first.

set -euo pipefail

IN_FILE="${1:-}"
if [[ -z "$IN_FILE" || ! -f "$IN_FILE" ]]; then
  echo "Usage: $0 <backup.dump.age>" >&2
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

if [[ -z "${BACKUP_AGE_IDENTITY:-}" ]]; then
  echo "BACKUP_AGE_IDENTITY (path to age identity) is required" >&2
  exit 1
fi

for cmd in age pg_restore; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "$cmd not found on PATH" >&2
    exit 1
  fi
done

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

echo "Decrypting ${IN_FILE}…" >&2
age -d -i "$BACKUP_AGE_IDENTITY" -o "$TMP" "$IN_FILE"

echo "Restoring into DATABASE_URL (destructive)…" >&2
pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" "$TMP"
echo "Restore complete." >&2
