"""
Compliance Jobs
Automated compliance reporting and validation tasks
"""

from celery import Celery
from datetime import datetime, timedelta
import structlog
from app.services.compliance_service import compliance_service
from app.extensions import db
from app.models.tenant import Tenant

logger = structlog.get_logger(__name__)

# Initialize Celery app
celery_app = Celery('compliance_jobs')


@celery_app.task(bind=True, max_retries=3)
def daily_compliance_check(self):
    """Run daily compliance checks for all tenants."""
    try:
        logger.info("Starting daily compliance check")
        
        # Get all active tenants
        tenants = db.session.query(Tenant).filter(Tenant.is_active == True).all()
        
        compliance_results = []
        for tenant in tenants:
            try:
                # Generate compliance summary
                summary = compliance_service.generate_compliance_summary(tenant.id)
                compliance_results.append({
                    'tenant_id': tenant.id,
                    'tenant_name': tenant.name,
                    'compliance_score': summary['overall_compliance_score'],
                    'status': 'success'
                })
                
                logger.info("Compliance check completed for tenant", 
                           tenant_id=tenant.id,
                           compliance_score=summary['overall_compliance_score'])
                
            except Exception as e:
                logger.error("Compliance check failed for tenant", 
                           error=str(e), tenant_id=tenant.id)
                compliance_results.append({
                    'tenant_id': tenant.id,
                    'tenant_name': tenant.name,
                    'compliance_score': 0,
                    'status': 'failed',
                    'error': str(e)
                })
        
        logger.info("Daily compliance check completed", 
                   total_tenants=len(tenants),
                   successful_checks=len([r for r in compliance_results if r['status'] == 'success']))
        
        return compliance_results
        
    except Exception as e:
        logger.error("Daily compliance check failed", error=str(e))
        raise self.retry(countdown=300, exc=e)  # Retry in 5 minutes


@celery_app.task(bind=True, max_retries=3)
def weekly_gdpr_report(self):
    """Generate weekly GDPR reports for all tenants."""
    try:
        logger.info("Starting weekly GDPR report generation")
        
        # Get all active tenants
        tenants = db.session.query(Tenant).filter(Tenant.is_active == True).all()
        
        report_results = []
        for tenant in tenants:
            try:
                # Generate GDPR report
                report = compliance_service.generate_gdpr_report(tenant.id, 'data_processing_activities')
                report_results.append({
                    'tenant_id': tenant.id,
                    'tenant_name': tenant.name,
                    'report_id': report['report_id'],
                    'status': 'success'
                })
                
                logger.info("GDPR report generated for tenant", 
                           tenant_id=tenant.id,
                           report_id=report['report_id'])
                
            except Exception as e:
                logger.error("GDPR report generation failed for tenant", 
                           error=str(e), tenant_id=tenant.id)
                report_results.append({
                    'tenant_id': tenant.id,
                    'tenant_name': tenant.name,
                    'status': 'failed',
                    'error': str(e)
                })
        
        logger.info("Weekly GDPR report generation completed", 
                   total_tenants=len(tenants),
                   successful_reports=len([r for r in report_results if r['status'] == 'success']))
        
        return report_results
        
    except Exception as e:
        logger.error("Weekly GDPR report generation failed", error=str(e))
        raise self.retry(countdown=600, exc=e)  # Retry in 10 minutes


@celery_app.task(bind=True, max_retries=3)
def monthly_audit_report(self):
    """Generate monthly audit reports for all tenants."""
    try:
        logger.info("Starting monthly audit report generation")
        
        # Get all active tenants
        tenants = db.session.query(Tenant).filter(Tenant.is_active == True).all()
        
        # Calculate date range (last month)
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=30)
        
        report_results = []
        for tenant in tenants:
            try:
                # Generate audit report
                report = compliance_service.generate_audit_report(tenant.id, start_date, end_date)
                report_results.append({
                    'tenant_id': tenant.id,
                    'tenant_name': tenant.name,
                    'report_id': report['report_id'],
                    'status': 'success'
                })
                
                logger.info("Audit report generated for tenant", 
                           tenant_id=tenant.id,
                           report_id=report['report_id'])
                
            except Exception as e:
                logger.error("Audit report generation failed for tenant", 
                           error=str(e), tenant_id=tenant.id)
                report_results.append({
                    'tenant_id': tenant.id,
                    'tenant_name': tenant.name,
                    'status': 'failed',
                    'error': str(e)
                })
        
        logger.info("Monthly audit report generation completed", 
                   total_tenants=len(tenants),
                   successful_reports=len([r for r in report_results if r['status'] == 'success']))
        
        return report_results
        
    except Exception as e:
        logger.error("Monthly audit report generation failed", error=str(e))
        raise self.retry(countdown=900, exc=e)  # Retry in 15 minutes


@celery_app.task(bind=True, max_retries=3)
def quarterly_pci_report(self):
    """Generate quarterly PCI reports for all tenants."""
    try:
        logger.info("Starting quarterly PCI report generation")
        
        # Get all active tenants
        tenants = db.session.query(Tenant).filter(Tenant.is_active == True).all()
        
        report_results = []
        for tenant in tenants:
            try:
                # Generate PCI report
                report = compliance_service.generate_pci_report(tenant.id)
                report_results.append({
                    'tenant_id': tenant.id,
                    'tenant_name': tenant.name,
                    'report_id': report['report_id'],
                    'status': 'success'
                })
                
                logger.info("PCI report generated for tenant", 
                           tenant_id=tenant.id,
                           report_id=report['report_id'])
                
            except Exception as e:
                logger.error("PCI report generation failed for tenant", 
                           error=str(e), tenant_id=tenant.id)
                report_results.append({
                    'tenant_id': tenant.id,
                    'tenant_name': tenant.name,
                    'status': 'failed',
                    'error': str(e)
                })
        
        logger.info("Quarterly PCI report generation completed", 
                   total_tenants=len(tenants),
                   successful_reports=len([r for r in report_results if r['status'] == 'success']))
        
        return report_results
        
    except Exception as e:
        logger.error("Quarterly PCI report generation failed", error=str(e))
        raise self.retry(countdown=1200, exc=e)  # Retry in 20 minutes


@celery_app.task(bind=True, max_retries=3)
def data_retention_cleanup(self):
    """Clean up data that exceeds retention policies."""
    try:
        logger.info("Starting data retention cleanup")
        
        # Get all active tenants
        tenants = db.session.query(Tenant).filter(Tenant.is_active == True).all()
        
        cleanup_results = []
        for tenant in tenants:
            try:
                # Validate data retention
                validation = compliance_service.validate_data_retention(tenant.id)
                
                # Process violations
                violations_processed = 0
                for violation in validation.get('violations', []):
                    if violation['type'] == 'audit_log_retention':
                        # Clean up old audit logs
                        violations_processed += 1
                
                cleanup_results.append({
                    'tenant_id': tenant.id,
                    'tenant_name': tenant.name,
                    'violations_found': len(validation.get('violations', [])),
                    'violations_processed': violations_processed,
                    'status': 'success'
                })
                
                logger.info("Data retention cleanup completed for tenant", 
                           tenant_id=tenant.id,
                           violations_processed=violations_processed)
                
            except Exception as e:
                logger.error("Data retention cleanup failed for tenant", 
                           error=str(e), tenant_id=tenant.id)
                cleanup_results.append({
                    'tenant_id': tenant.id,
                    'tenant_name': tenant.name,
                    'status': 'failed',
                    'error': str(e)
                })
        
        logger.info("Data retention cleanup completed", 
                   total_tenants=len(tenants),
                   successful_cleanups=len([r for r in cleanup_results if r['status'] == 'success']))
        
        return cleanup_results
        
    except Exception as e:
        logger.error("Data retention cleanup failed", error=str(e))
        raise self.retry(countdown=1800, exc=e)  # Retry in 30 minutes


@celery_app.task(bind=True, max_retries=3)
def compliance_alert_check(self):
    """Check for compliance violations and send alerts."""
    try:
        logger.info("Starting compliance alert check")
        
        # Get all active tenants
        tenants = db.session.query(Tenant).filter(Tenant.is_active == True).all()
        
        alert_results = []
        for tenant in tenants:
            try:
                # Generate compliance summary
                summary = compliance_service.generate_compliance_summary(tenant.id)
                
                # Check for violations
                alerts_sent = 0
                if summary['overall_compliance_score'] < 80:
                    # Send critical compliance alert
                    alerts_sent += 1
                    logger.warning("Critical compliance alert sent", 
                                 tenant_id=tenant.id,
                                 compliance_score=summary['overall_compliance_score'])
                
                alert_results.append({
                    'tenant_id': tenant.id,
                    'tenant_name': tenant.name,
                    'compliance_score': summary['overall_compliance_score'],
                    'alerts_sent': alerts_sent,
                    'status': 'success'
                })
                
            except Exception as e:
                logger.error("Compliance alert check failed for tenant", 
                           error=str(e), tenant_id=tenant.id)
                alert_results.append({
                    'tenant_id': tenant.id,
                    'tenant_name': tenant.name,
                    'status': 'failed',
                    'error': str(e)
                })
        
        logger.info("Compliance alert check completed", 
                   total_tenants=len(tenants),
                   total_alerts=sum(r.get('alerts_sent', 0) for r in alert_results))
        
        return alert_results
        
    except Exception as e:
        logger.error("Compliance alert check failed", error=str(e))
        raise self.retry(countdown=300, exc=e)  # Retry in 5 minutes


# Schedule compliance jobs
from celery.schedules import crontab

celery_app.conf.beat_schedule = {
    'daily-compliance-check': {
        'task': 'compliance_jobs.daily_compliance_check',
        'schedule': crontab(hour=1, minute=0),  # Daily at 1 AM
    },
    'weekly-gdpr-report': {
        'task': 'compliance_jobs.weekly_gdpr_report',
        'schedule': crontab(hour=2, minute=0, day_of_week=1),  # Weekly on Monday at 2 AM
    },
    'monthly-audit-report': {
        'task': 'compliance_jobs.monthly_audit_report',
        'schedule': crontab(hour=3, minute=0, day=1),  # Monthly on 1st at 3 AM
    },
    'quarterly-pci-report': {
        'task': 'compliance_jobs.quarterly_pci_report',
        'schedule': crontab(hour=4, minute=0, day=1, month_of_year='1,4,7,10'),  # Quarterly
    },
    'data-retention-cleanup': {
        'task': 'compliance_jobs.data_retention_cleanup',
        'schedule': crontab(hour=5, minute=0, day_of_week=0),  # Weekly on Sunday at 5 AM
    },
    'compliance-alert-check': {
        'task': 'compliance_jobs.compliance_alert_check',
        'schedule': crontab(hour=6, minute=0),  # Daily at 6 AM
    },
}
