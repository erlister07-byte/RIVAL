#!/usr/bin/env sh
set -eu

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SEED_FILE="$ROOT_DIR/supabase/seeds/local_seed.sql"

if [ ! -f "$SEED_FILE" ]; then
  echo "Seed file not found: $SEED_FILE" >&2
  exit 1
fi

if [ -n "${SUPABASE_DB_URL:-}" ]; then
  psql "$SUPABASE_DB_URL" -f "$SEED_FILE"
  exit 0
fi

if command -v supabase >/dev/null 2>&1; then
  supabase db query < "$SEED_FILE"
  exit 0
fi

echo "Set SUPABASE_DB_URL or install the Supabase CLI to run the local seed." >&2
exit 1
