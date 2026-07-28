#!/usr/bin/env bash
# Encrypted Postgres backup. AGENTS.md §27 / T12
# Requires: pg_dump, age (https://github.com/FiloSottile/age)
#
# Usage:
#   export DATABASE_URL=postgres://...
#   export BACKUP_AGE_RECIPIENT=age1...   # or BACKUP_AGE_RECIPIENTS=file with recipients
#   ./scripts/backup.sh [output-dir]
#
# Note: dumps contain encrypted OAuth blobs but plaintext email text unless
# EMAIL_BODY_ENCRYPTION=on. Treat backup files as sensitive.

set -euo pipefail

OUT_DIR="${1:-./backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$OUT_DIR"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

if [[ -z "${BACKUP_AGE_RECIPIENT:-}" && -z "${BACKUP_AGE_RECIPIENTS:-}" ]]; then
  echo "Set BACKUP_AGE_RECIPIENT (age1...) or BACKUP_AGE_RECIPIENTS (path to recipients file)" >&2
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump not found on PATH" >&2
  exit 1
fi

if ! command -v age >/dev/null 2>&1; then
  echo "age not found on PATH — install https://github.com/FiloSottile/age" >&2
  exit 1
fi

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

echo "Dumping database…" >&2
pg_dump --no-owner --format=custom "$DATABASE_URL" >"$TMP"

OUT_FILE="${OUT_DIR}/apptrack-${STAMP}.dump.age"
echo "Encrypting → ${OUT_FILE}" >&2

AGE_ARGS=()
if [[ -n "${BACKUP_AGE_RECIPIENT:-}" ]]; then
  AGE_ARGS+=(-r "$BACKUP_AGE_RECIPIENT")
fi
if [[ -n "${BACKUP_AGE_RECIPIENTS:-}" ]]; then
  AGE_ARGS+=(-R "$BACKUP_AGE_RECIPIENTS")
fi

age "${AGE_ARGS[@]}" -o "$OUT_FILE" "$TMP"
echo "Wrote ${OUT_FILE}" >&2
