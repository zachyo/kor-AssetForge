#!/bin/bash
set -e

# Load environment variables
if [ -f backend/.env ]; then
    export $(grep -v '^#' backend/.env | xargs)
fi

DB_URL=${DATABASE_URL:-"postgres://postgres:password@localhost:5432/assetforge"}
BACKUP_DIR="backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/assetforge_${TIMESTAMP}.dump"

mkdir -p ${BACKUP_DIR}

echo "Backing up database to ${BACKUP_FILE}..."

if command -v pg_dump &> /dev/null; then
    # Create point-in-time recovery compatible custom format backup (-Fc)
    pg_dump -Fc ${DB_URL} > ${BACKUP_FILE}
    
    # Backup verification
    echo "Verifying backup..."
    if pg_restore -l ${BACKUP_FILE} > /dev/null; then
        echo "Backup verified successfully."
    else
        echo "Backup verification failed!"
        exit 1
    fi

    echo "Backup completed: ${BACKUP_FILE}"
    
    # Enforce backup retention policy: keep only last 30 days
    echo "Cleaning up backups older than 30 days..."
    find ${BACKUP_DIR} -name "assetforge_*.dump" -type f -mtime +30 -exec rm {} \;
else
    echo "Warning: pg_dump not found. Skipping backup."
fi

# Automated scheduling note:
# To run this daily at 2am, add the following to your crontab (crontab -e):
# 0 2 * * * /path/to/kor-AssetForge/scripts/backup_db.sh >> /var/log/assetforge_backup.log 2>&1
