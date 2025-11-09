"""
Backup and Disaster Recovery Service
Provides automated backup procedures, point-in-time recovery, and disaster recovery
"""

import os
import subprocess
import boto3
import psycopg2
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
import structlog
from sqlalchemy import text
from app.extensions import db

logger = structlog.get_logger(__name__)


class BackupService:
    """Service for managing database backups and disaster recovery."""
    
    def __init__(self):
        self.s3_client = None
        self.backup_bucket = os.getenv('BACKUP_S3_BUCKET')
        self.backup_region = os.getenv('BACKUP_S3_REGION', 'us-east-1')
        self.database_url = os.getenv('DATABASE_URL')
        
        if self.backup_bucket:
            self.s3_client = boto3.client(
                's3',
                region_name=self.backup_region,
                aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
                aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY')
            )
    
    def create_full_backup(self) -> Dict[str, Any]:
        """Create a full database backup."""
        try:
            timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
            backup_filename = f"tithi_full_backup_{timestamp}.sql"
            local_path = f"/tmp/{backup_filename}"
            
            # Create backup using pg_dump
            cmd = [
                'pg_dump',
                self.database_url,
                '--verbose',
                '--clean',
                '--create',
                '--if-exists',
                '--format=plain',
                f'--file={local_path}'
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            
            # Upload to S3 if configured
            s3_key = f"backups/full/{backup_filename}"
            if self.s3_client:
                self.s3_client.upload_file(local_path, self.backup_bucket, s3_key)
                logger.info("Backup uploaded to S3", s3_key=s3_key)
            
            # Clean up local file
            os.remove(local_path)
            
            backup_info = {
                'type': 'full',
                'filename': backup_filename,
                's3_key': s3_key if self.s3_client else None,
                'timestamp': timestamp,
                'size_bytes': result.stdout.count('\n') if result.stdout else 0
            }
            
            logger.info("Full backup created successfully", **backup_info)
            return backup_info
            
        except Exception as e:
            logger.error("Failed to create full backup", error=str(e))
            raise
    
    def create_incremental_backup(self) -> Dict[str, Any]:
        """Create an incremental backup using WAL files."""
        try:
            timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
            
            # Archive current WAL file
            with db.engine.connect() as conn:
                result = conn.execute(text("SELECT pg_switch_wal()"))
                wal_file = result.scalar()
            
            backup_info = {
                'type': 'incremental',
                'wal_file': wal_file,
                'timestamp': timestamp,
                's3_key': f"backups/wal/{wal_file}" if self.s3_client else None
            }
            
            # Upload WAL file to S3
            if self.s3_client and wal_file:
                wal_path = f"/var/lib/postgresql/data/pg_wal/{wal_file}"
                if os.path.exists(wal_path):
                    self.s3_client.upload_file(wal_path, self.backup_bucket, backup_info['s3_key'])
                    logger.info("WAL file uploaded to S3", wal_file=wal_file)
            
            logger.info("Incremental backup created successfully", **backup_info)
            return backup_info
            
        except Exception as e:
            logger.error("Failed to create incremental backup", error=str(e))
            raise
    
    def restore_from_backup(self, backup_filename: str, target_database: Optional[str] = None) -> Dict[str, Any]:
        """Restore database from a backup file."""
        try:
            target_db = target_database or self.database_url
            
            # Download from S3 if needed
            local_path = f"/tmp/{backup_filename}"
            if self.s3_client:
                s3_key = f"backups/full/{backup_filename}"
                self.s3_client.download_file(self.backup_bucket, s3_key, local_path)
            
            # Restore using psql
            cmd = ['psql', target_db, '-f', local_path]
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            
            # Clean up local file
            if os.path.exists(local_path):
                os.remove(local_path)
            
            restore_info = {
                'backup_filename': backup_filename,
                'target_database': target_db,
                'timestamp': datetime.utcnow().isoformat(),
                'success': True
            }
            
            logger.info("Database restored successfully", **restore_info)
            return restore_info
            
        except Exception as e:
            logger.error("Failed to restore database", error=str(e), backup_filename=backup_filename)
            raise
    
    def point_in_time_recovery(self, target_time: datetime) -> Dict[str, Any]:
        """Perform point-in-time recovery to a specific timestamp."""
        try:
            # Create recovery target
            recovery_target = target_time.strftime('%Y-%m-%d %H:%M:%S')
            
            # Find the closest backup before target time
            backup_files = self.list_backups()
            suitable_backup = None
            
            for backup in backup_files:
                backup_time = datetime.strptime(backup['timestamp'], '%Y%m%d_%H%M%S')
                if backup_time <= target_time:
                    suitable_backup = backup
                    break
            
            if not suitable_backup:
                raise ValueError(f"No suitable backup found before {target_time}")
            
            # Restore from backup
            restore_info = self.restore_from_backup(suitable_backup['filename'])
            
            # Apply WAL files up to target time
            wal_files = self.list_wal_files()
            for wal_file in wal_files:
                wal_time = self.get_wal_timestamp(wal_file)
                if wal_time and wal_time <= target_time:
                    self.apply_wal_file(wal_file)
                elif wal_time and wal_time > target_time:
                    break
            
            pitr_info = {
                'target_time': recovery_target,
                'backup_used': suitable_backup['filename'],
                'timestamp': datetime.utcnow().isoformat(),
                'success': True
            }
            
            logger.info("Point-in-time recovery completed", **pitr_info)
            return pitr_info
            
        except Exception as e:
            logger.error("Failed point-in-time recovery", error=str(e), target_time=target_time)
            raise
    
    def list_backups(self) -> List[Dict[str, Any]]:
        """List all available backups."""
        try:
            if not self.s3_client:
                return []
            
            response = self.s3_client.list_objects_v2(
                Bucket=self.backup_bucket,
                Prefix='backups/full/'
            )
            
            backups = []
            for obj in response.get('Contents', []):
                filename = obj['Key'].split('/')[-1]
                if filename.endswith('.sql'):
                    timestamp = filename.replace('tithi_full_backup_', '').replace('.sql', '')
                    backups.append({
                        'filename': filename,
                        'timestamp': timestamp,
                        'size_bytes': obj['Size'],
                        'last_modified': obj['LastModified'].isoformat()
                    })
            
            return sorted(backups, key=lambda x: x['timestamp'], reverse=True)
            
        except Exception as e:
            logger.error("Failed to list backups", error=str(e))
            return []
    
    def list_wal_files(self) -> List[str]:
        """List available WAL files."""
        try:
            if not self.s3_client:
                return []
            
            response = self.s3_client.list_objects_v2(
                Bucket=self.backup_bucket,
                Prefix='backups/wal/'
            )
            
            wal_files = []
            for obj in response.get('Contents', []):
                wal_file = obj['Key'].split('/')[-1]
                wal_files.append(wal_file)
            
            return sorted(wal_files)
            
        except Exception as e:
            logger.error("Failed to list WAL files", error=str(e))
            return []
    
    def get_wal_timestamp(self, wal_file: str) -> Optional[datetime]:
        """Get timestamp from WAL file."""
        try:
            # Extract timestamp from WAL file name
            # WAL files are named with hex timestamps
            wal_id = wal_file.split('.')[0]
            timestamp = int(wal_id, 16)
            return datetime.fromtimestamp(timestamp / 1000000)
        except Exception:
            return None
    
    def apply_wal_file(self, wal_file: str) -> bool:
        """Apply a WAL file for recovery."""
        try:
            # Download WAL file
            local_path = f"/tmp/{wal_file}"
            s3_key = f"backups/wal/{wal_file}"
            
            if self.s3_client:
                self.s3_client.download_file(self.backup_bucket, s3_key, local_path)
            
            # Apply WAL file
            cmd = ['pg_receivewal', '--source', local_path]
            subprocess.run(cmd, capture_output=True, text=True, check=True)
            
            # Clean up
            if os.path.exists(local_path):
                os.remove(local_path)
            
            return True
            
        except Exception as e:
            logger.error("Failed to apply WAL file", error=str(e), wal_file=wal_file)
            return False
    
    def test_backup_integrity(self, backup_filename: str) -> Dict[str, Any]:
        """Test the integrity of a backup file."""
        try:
            # Download backup
            local_path = f"/tmp/{backup_filename}"
            s3_key = f"backups/full/{backup_filename}"
            
            if self.s3_client:
                self.s3_client.download_file(self.backup_bucket, s3_key, local_path)
            
            # Test backup integrity
            cmd = ['pg_restore', '--list', local_path]
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            integrity_info = {
                'backup_filename': backup_filename,
                'is_valid': result.returncode == 0,
                'error_message': result.stderr if result.returncode != 0 else None,
                'timestamp': datetime.utcnow().isoformat()
            }
            
            # Clean up
            if os.path.exists(local_path):
                os.remove(local_path)
            
            logger.info("Backup integrity test completed", **integrity_info)
            return integrity_info
            
        except Exception as e:
            logger.error("Failed to test backup integrity", error=str(e), backup_filename=backup_filename)
            return {
                'backup_filename': backup_filename,
                'is_valid': False,
                'error_message': str(e),
                'timestamp': datetime.utcnow().isoformat()
            }
    
    def cleanup_old_backups(self, retention_days: int = 30) -> Dict[str, Any]:
        """Clean up old backups based on retention policy."""
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=retention_days)
            deleted_count = 0
            
            if self.s3_client:
                # List all backups
                response = self.s3_client.list_objects_v2(
                    Bucket=self.backup_bucket,
                    Prefix='backups/'
                )
                
                for obj in response.get('Contents', []):
                    if obj['LastModified'].replace(tzinfo=None) < cutoff_date:
                        self.s3_client.delete_object(
                            Bucket=self.backup_bucket,
                            Key=obj['Key']
                        )
                        deleted_count += 1
            
            cleanup_info = {
                'retention_days': retention_days,
                'cutoff_date': cutoff_date.isoformat(),
                'deleted_count': deleted_count,
                'timestamp': datetime.utcnow().isoformat()
            }
            
            logger.info("Backup cleanup completed", **cleanup_info)
            return cleanup_info
            
        except Exception as e:
            logger.error("Failed to cleanup old backups", error=str(e))
            raise


# Global backup service instance
backup_service = BackupService()
