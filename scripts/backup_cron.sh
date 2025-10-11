#!/bin/bash
# Daily backup script for Tithi database

# Set environment variables
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tithi"
export BACKUP_DIR="/var/backups/tithi"
export S3_BACKUP_BUCKET="tithi-backups"

# Create backup directory
mkdir -p $BACKUP_DIR

# Run daily full backup
python3 /path/to/tithi/scripts/backup_database.py backup --type full

# Run weekly schema backup (on Sundays)
if [ $(date +%u) -eq 7 ]; then
    python3 /path/to/tithi/scripts/backup_database.py backup --type schema
fi

# Log backup completion
echo "$(date): Daily backup completed" >> /var/log/tithi_backup.log
