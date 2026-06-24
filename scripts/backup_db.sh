#!/usr/bin/env bash
# backup_db.sh — Create a verified, compressed PostgreSQL backup and optionally upload to S3.
#
# Required environment variables:
#   DATABASE_URL            PostgreSQL connection string
#
# Optional:
#   BACKUP_S3_BUCKET        S3 bucket name (upload skipped if not set)
#   BACKUP_S3_REGION        AWS region (default: us-east-1)
#   BACKUP_S3_PREFIX        S3 key prefix (default: kor-assetforge/backups)
#   BACKUP_TEMP_DIR         Local temp/output directory (default: backups/)
#   BACKUP_RETENTION_DAYS   Days to keep local backups (default: 30)

set -euo pipefail

# --- Load .env if present ---
if [ -f backend/.env ]; then
    set -o allexport
    # shellcheck disable=SC1091
    source <(grep -v '^#' backend/.env | grep -v '^\s*$')
    set +o allexport
fi

DATABASE_URL="${DATABASE_URL:-postgres://postgres:password@localhost:5432/assetforge}"
BACKUP_S3_BUCKET="${BACKUP_S3_BUCKET:-}"
BACKUP_S3_REGION="${BACKUP_S3_REGION:-us-east-1}"
BACKUP_S3_PREFIX="${BACKUP_S3_PREFIX:-kor-assetforge/backups}"
BACKUP_TEMP_DIR="${BACKUP_TEMP_DIR:-backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

TIMESTAMP="$(date -u +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_TEMP_DIR}/assetforge_${TIMESTAMP}.dump"

mkdir -p "${BACKUP_TEMP_DIR}"

echo "[backup] Starting backup at $(date -u)"

if ! command -v pg_dump &>/dev/null; then
    echo "[backup] WARNING: pg_dump not found. Skipping backup." >&2
    exit 0
fi

# --- Dump (custom format for point-in-time recovery) ---
echo "[backup] Running pg_dump..."
pg_dump -Fc "${DATABASE_URL}" > "${BACKUP_FILE}"
echo "[backup] Dump complete: ${BACKUP_FILE} ($(du -sh "${BACKUP_FILE}" | cut -f1))"

# --- Verify integrity ---
echo "[backup] Verifying backup integrity..."
if pg_restore -l "${BACKUP_FILE}" > /dev/null; then
    echo "[backup] Integrity check passed."
else
    echo "[backup] ERROR: Integrity check failed. Removing corrupt dump." >&2
    rm -f "${BACKUP_FILE}"
    exit 1
fi

# --- Upload to S3 (optional) ---
if [ -n "${BACKUP_S3_BUCKET}" ]; then
    if ! command -v aws &>/dev/null; then
        echo "[backup] WARNING: aws CLI not found. Skipping S3 upload." >&2
    else
        S3_KEY="${BACKUP_S3_PREFIX}/$(basename "${BACKUP_FILE}")"
        echo "[backup] Uploading to s3://${BACKUP_S3_BUCKET}/${S3_KEY}..."
        aws s3 cp "${BACKUP_FILE}" "s3://${BACKUP_S3_BUCKET}/${S3_KEY}" \
            --region "${BACKUP_S3_REGION}" \
            --sse AES256
        echo "[backup] Upload complete."
    fi
fi

# --- Enforce local retention policy ---
echo "[backup] Removing local backups older than ${BACKUP_RETENTION_DAYS} days..."
find "${BACKUP_TEMP_DIR}" -name "assetforge_*.dump" -type f -mtime "+${BACKUP_RETENTION_DAYS}" -exec rm -v {} \;

echo "[backup] Completed at $(date -u)"

# --- Crontab scheduling ---
# Run daily at 03:00 UTC by adding to crontab (crontab -e):
# 0 3 * * * /path/to/kor-AssetForge/scripts/backup_db.sh >> /var/log/assetforge_backup.log 2>&1
