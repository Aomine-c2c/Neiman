#!/bin/bash
# NEIMAN Database Backup Script
# Usage: ./backup-db.sh [full|incremental]

set -euo pipefail

BACKUP_TYPE="${1:-full}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="/backups"
S3_BUCKET="${BACKUP_S3_BUCKET:-s3://NEIMAN-backups/postgresql}"

echo "💾 NEIMAN Database Backup - Type: ${BACKUP_TYPE}"
echo "================================================="

# Create backup directory
mkdir -p "${BACKUP_DIR}"

if [[ "${BACKUP_TYPE}" == "full" ]]; then
    echo "📦 Creating full backup..."
    BACKUP_FILE="${BACKUP_DIR}/NEIMAN-full-${TIMESTAMP}.dump"
    
    kubectl exec -n NEIMAN-database postgresql-0 -- pg_dump -U NEIMAN -Fc -d NEIMAN > "${BACKUP_FILE}"
    
    echo "☁️  Uploading to S3..."
    aws s3 cp "${BACKUP_FILE}" "${S3_BUCKET}/full/${TIMESTAMP}.dump"
    
    # Cleanup local
    rm "${BACKUP_FILE}"
    
elif [[ "${BACKUP_TYPE}" == "incremental" ]]; then
    echo "📦 Creating incremental backup (WAL)..."
    # This requires WAL archiving to be configured
    # For now, we'll do a full backup as incremental
    BACKUP_FILE="${BACKUP_DIR}/NEIMAN-inc-${TIMESTAMP}.dump"
    
    kubectl exec -n NEIMAN-database postgresql-0 -- pg_dump -U NEIMAN -Fc -d NEIMAN > "${BACKUP_FILE}"
    
    echo "☁️  Uploading to S3..."
    aws s3 cp "${BACKUP_FILE}" "${S3_BUCKET}/incremental/${TIMESTAMP}.dump"
    
    rm "${BACKUP_FILE}"
    
else
    echo "❌ Invalid backup type. Use 'full' or 'incremental'"
    exit 1
fi

# Cleanup old backups (keep last 30 days)
echo "🧹 Cleaning up old backups..."
aws s3 ls "${S3_BUCKET}/full/" | while read -r line; do
    DATE=$(echo "${line}" | awk '{print $1}')
    if [[ $(date -d "${DATE}" +%s) -lt $(date -d "30 days ago" +%s) ]]; then
        FILE=$(echo "${line}" | awk '{print $4}')
        aws s3 rm "${S3_BUCKET}/full/${FILE}"
    fi
done

aws s3 ls "${S3_BUCKET}/incremental/" | while read -r line; do
    DATE=$(echo "${line}" | awk '{print $1}')
    if [[ $(date -d "${DATE}" +%s) -lt $(date -d "7 days ago" +%s) ]]; then
        FILE=$(echo "${line}" | awk '{print $4}')
        aws s3 rm "${S3_BUCKET}/incremental/${FILE}"
    fi
done

echo "✅ Backup complete!"
echo "   Backup stored at: ${S3_BUCKET}/${BACKUP_TYPE}/${TIMESTAMP}.dump"