#!/usr/bin/env bash
# Create a PostgreSQL dump file for backup or deployment migration
# Usage: ./create_dump.sh [schema-only]
# Uses POSTGRES_* from ../.env or defaults

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
OUT_DIR="$BACKEND_DIR/dumps"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILE="bid_intelligence_dump_$TIMESTAMP.sql"

# Defaults
DB_NAME="${POSTGRES_DB:-Bid2}"
DB_USER="${POSTGRES_USER:-postgres}"
DB_HOST="${POSTGRES_HOST:-127.0.0.1}"
DB_PORT="${POSTGRES_PORT:-5432}"

# Load .env
if [ -f "$BACKEND_DIR/.env" ]; then
  set -a
  source "$BACKEND_DIR/.env" 2>/dev/null || true
  set +a
fi

export PGPASSWORD="${POSTGRES_PASSWORD:-postgres}"
mkdir -p "$OUT_DIR"
OUT_PATH="$OUT_DIR/$FILE"

SCHEMA_ONLY=""
[ "$1" = "schema-only" ] && SCHEMA_ONLY="--schema-only"

echo "Dumping database '$DB_NAME' to $OUT_PATH ..."
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  --no-owner --no-acl -f "$OUT_PATH" $SCHEMA_ONLY

echo "Done. Dump file: $OUT_PATH"
