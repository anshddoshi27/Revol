"""
Notification CLI Commands

Provides CLI commands for testing and managing the notification system.
"""

import click
from datetime import datetime, timedelta
from typing import Dict, Any

from ..services.notification_service import NotificationService
from ..services.notification_template_service import StandardizedTemplateService
from ..jobs.notification_cron_runner import NotificationCronRunner
from ..models.notification import NotificationTemplate, NotificationChannel
from ..models.business import Booking
from ..models.tenant import Tenant
from ..database import db


@click.group()
def notifications():
    """Notification management commands."""
    pass


@notifications.command()
@click.option('--tenant-id', required=True, help='Tenant ID to create templates for')
def create_default_templates(tenant_id: str):
    """Create default standardized templates for a tenant."""
    try:
        import uuid
        tenant_uuid = uuid.UUID(tenant_id)
        
        template_service = StandardizedTemplateService()
        templates = template_service.create_default_templates(tenant_uuid)
        
        for template in templates:
            db.session.add(template)
        
        db.session.commit()
        
        click.echo(f"Created {len(templates)} default templates for tenant {tenant_id}")
        for template in templates:
            click.echo(f"  - {template.name}: {template.trigger_event} via {template.channel}")
            
    except Exception as e:
        click.echo(f"Error creating templates: {str(e)}", err=True)
        db.session.rollback()


@notifications.command()
@click.option('--tenant-id', required=True, help='Tenant ID to process notifications for')
def process_due(tenant_id: str):
    """Process due notifications for a tenant."""
    try:
        import uuid
        tenant_uuid = uuid.UUID(tenant_id)
        
        runner = NotificationCronRunner()
        result = runner.process_due_notifications()
        
        if result['success']:
            stats = result['stats']
            click.echo(f"Processed {stats['processed']} notifications:")
            click.echo(f"  - Successful: {stats['successful']}")
            click.echo(f"  - Failed: {stats['failed']}")
        else:
            click.echo(f"Error processing notifications: {result['error']}", err=True)
            
    except Exception as e:
        click.echo(f"Error: {str(e)}", err=True)


@notifications.command()
def schedule_reminders():
    """Schedule booking reminders (24h/1h)."""
    try:
        runner = NotificationCronRunner()
        result = runner.schedule_booking_reminders()
        
        if result['success']:
            stats = result['stats']
            click.echo(f"Scheduled reminders:")
            click.echo(f"  - 24h reminders: {stats['scheduled_24h']}")
            click.echo(f"  - 1h reminders: {stats['scheduled_1h']}")
            click.echo(f"  - Total: {stats['total_scheduled']}")
        else:
            click.echo(f"Error scheduling reminders: {result['error']}", err=True)
            
    except Exception as e:
        click.echo(f"Error: {str(e)}", err=True)


@notifications.command()
@click.option('--tenant-id', required=True, help='Tenant ID')
@click.option('--booking-id', required=True, help='Booking ID to test')
@click.option('--event-type', default='booking_confirmed', help='Event type to test')
def test_booking_notification(tenant_id: str, booking_id: str, event_type: str):
    """Test booking notification sending."""
    try:
        import uuid
        tenant_uuid = uuid.UUID(tenant_id)
        booking_uuid = uuid.UUID(booking_id)
        
        # Get booking
        booking = Booking.query.filter_by(
            id=booking_uuid,
            tenant_id=tenant_uuid
        ).first()
        
        if not booking:
            click.echo(f"Booking {booking_id} not found", err=True)
            return
        
        # Send notification
        notification_service = NotificationService()
        result = notification_service.send_booking_notification(booking, event_type)
        
        if result.success:
            click.echo(f"Successfully sent {event_type} notification for booking {booking_id}")
            if result.notification_id:
                click.echo(f"Notification ID: {result.notification_id}")
        else:
            click.echo(f"Failed to send notification: {result.error_message}", err=True)
            
    except Exception as e:
        click.echo(f"Error: {str(e)}", err=True)


@notifications.command()
@click.option('--tenant-id', required=True, help='Tenant ID')
def list_templates(tenant_id: str):
    """List notification templates for a tenant."""
    try:
        import uuid
        tenant_uuid = uuid.UUID(tenant_id)
        
        templates = NotificationTemplate.query.filter_by(
            tenant_id=tenant_uuid,
            is_active=True
        ).all()
        
        if not templates:
            click.echo("No templates found")
            return
        
        click.echo(f"Found {len(templates)} templates:")
        for template in templates:
            click.echo(f"  - {template.name}")
            click.echo(f"    Event: {template.trigger_event}")
            click.echo(f"    Channel: {template.channel}")
            click.echo(f"    Subject: {template.subject[:50]}..." if template.subject else "    Subject: None")
            click.echo()
            
    except Exception as e:
        click.echo(f"Error: {str(e)}", err=True)


@notifications.command()
@click.option('--content', required=True, help='Template content to validate')
def validate_placeholders(content: str):
    """Validate placeholder format in template content."""
    try:
        template_service = StandardizedTemplateService()
        
        if template_service.validate_placeholder_format(content):
            click.echo("✅ Template content has valid placeholder format")
            
            placeholders = template_service.extract_placeholders(content)
            if placeholders:
                click.echo(f"Found placeholders: {', '.join(placeholders)}")
            else:
                click.echo("No placeholders found")
        else:
            click.echo("❌ Template content has invalid placeholder format", err=True)
            click.echo("Use {{snake_case}} format for placeholders")
            
    except Exception as e:
        click.echo(f"Error: {str(e)}", err=True)


if __name__ == '__main__':
    notifications()
