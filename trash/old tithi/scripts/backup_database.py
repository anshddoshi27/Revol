#!/usr/bin/env python3
"""
Database Backup Script
Provides automated database backup with point-in-time recovery support
"""

import os
import sys
import subprocess
import boto3
from datetime import datetime, timedelta
import argparse
import logging
from pathlib import Path

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app import create_app
from app.extensions import db

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DatabaseBackup:
    """Database backup and recovery manager."""
    
    def __init__(self):
        self.app = create_app()
        self.backup_dir = Path(os.environ.get('BACKUP_DIR', '/tmp/tithi_backups'))
        self.backup_dir.mkdir(exist_ok=True)
        
        # AWS S3 configuration
        self.s3_bucket = os.environ.get('S3_BACKUP_BUCKET')
        self.s3_client = boto3.client('s3') if self.s3_bucket else None
        
        # Database configuration
        self.db_url = os.environ.get('DATABASE_URL')
        if not self.db_url:
            raise ValueError("DATABASE_URL environment variable is required")
    
    def create_backup(self, backup_type='full'):
        """Create database backup."""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_filename = f'tithi_backup_{backup_type}_{timestamp}.sql'
        backup_path = self.backup_dir / backup_filename
        
        logger.info(f"Creating {backup_type} backup: {backup_filename}")
        
        try:
            # Create backup using pg_dump
            cmd = [
                'pg_dump',
                self.db_url,
                '--verbose',
                '--no-password',
                '--format=custom',
                '--compress=9',
                f'--file={backup_path}'
            ]
            
            if backup_type == 'schema':
                cmd.append('--schema-only')
            elif backup_type == 'data':
                cmd.append('--data-only')
            
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            
            logger.info(f"Backup created successfully: {backup_path}")
            
            # Upload to S3 if configured
            if self.s3_client:
                self.upload_to_s3(backup_path, backup_filename)
            
            # Clean up old backups
            self.cleanup_old_backups()
            
            return backup_path
            
        except subprocess.CalledProcessError as e:
            logger.error(f"Backup failed: {e.stderr}")
            raise
    
    def upload_to_s3(self, backup_path, filename):
        """Upload backup to S3."""
        try:
            s3_key = f"backups/{filename}"
            self.s3_client.upload_file(
                str(backup_path),
                self.s3_bucket,
                s3_key
            )
            logger.info(f"Backup uploaded to S3: s3://{self.s3_bucket}/{s3_key}")
        except Exception as e:
            logger.error(f"S3 upload failed: {e}")
            raise
    
    def restore_backup(self, backup_path):
        """Restore database from backup."""
        logger.info(f"Restoring database from: {backup_path}")
        
        try:
            cmd = [
                'pg_restore',
                '--verbose',
                '--no-password',
                '--clean',
                '--if-exists',
                str(backup_path),
                self.db_url
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            
            logger.info("Database restored successfully")
            
        except subprocess.CalledProcessError as e:
            logger.error(f"Restore failed: {e.stderr}")
            raise
    
    def cleanup_old_backups(self, retention_days=30):
        """Clean up old backup files."""
        cutoff_date = datetime.now() - timedelta(days=retention_days)
        
        for backup_file in self.backup_dir.glob('tithi_backup_*.sql'):
            if backup_file.stat().st_mtime < cutoff_date.timestamp():
                backup_file.unlink()
                logger.info(f"Deleted old backup: {backup_file}")
    
    def list_backups(self):
        """List available backups."""
        backups = []
        
        # Local backups
        for backup_file in self.backup_dir.glob('tithi_backup_*.sql'):
            backups.append({
                'filename': backup_file.name,
                'path': str(backup_file),
                'size': backup_file.stat().st_size,
                'created': datetime.fromtimestamp(backup_file.stat().st_mtime),
                'location': 'local'
            })
        
        # S3 backups
        if self.s3_client:
            try:
                response = self.s3_client.list_objects_v2(
                    Bucket=self.s3_bucket,
                    Prefix='backups/'
                )
                
                for obj in response.get('Contents', []):
                    backups.append({
                        'filename': obj['Key'].split('/')[-1],
                        'path': f"s3://{self.s3_bucket}/{obj['Key']}",
                        'size': obj['Size'],
                        'created': obj['LastModified'],
                        'location': 's3'
                    })
            except Exception as e:
                logger.error(f"Failed to list S3 backups: {e}")
        
        return sorted(backups, key=lambda x: x['created'], reverse=True)


def main():
    """Main function for backup script."""
    parser = argparse.ArgumentParser(description='Tithi Database Backup Tool')
    parser.add_argument('action', choices=['backup', 'restore', 'list'], help='Action to perform')
    parser.add_argument('--type', choices=['full', 'schema', 'data'], default='full', help='Backup type')
    parser.add_argument('--file', help='Backup file path for restore')
    parser.add_argument('--retention-days', type=int, default=30, help='Backup retention days')
    
    args = parser.parse_args()
    
    backup_manager = DatabaseBackup()
    
    if args.action == 'backup':
        backup_manager.create_backup(args.type)
    elif args.action == 'restore':
        if not args.file:
            print("Error: --file is required for restore action")
            sys.exit(1)
        backup_manager.restore_backup(args.file)
    elif args.action == 'list':
        backups = backup_manager.list_backups()
        print(f"{'Filename':<50} {'Size':<10} {'Created':<20} {'Location':<10}")
        print("-" * 90)
        for backup in backups:
            print(f"{backup['filename']:<50} {backup['size']:<10} {backup['created']:<20} {backup['location']:<10}")


if __name__ == '__main__':
    main()
