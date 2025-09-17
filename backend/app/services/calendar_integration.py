"""
Google Calendar Integration Service

This module provides Google Calendar OAuth integration for staff scheduling
and two-way sync with work schedules.
"""

import uuid
import json
import base64
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from sqlalchemy.exc import SQLAlchemyError

from ..extensions import db
from ..models.business import StaffProfile, WorkSchedule
from ..models.core import Tenant, User, Membership
from ..models.system import AuditLog, EventOutbox


@dataclass
class CalendarEvent:
    """Represents a calendar event."""
    id: str
    summary: str
    description: Optional[str]
    start: datetime
    end: datetime
    location: Optional[str] = None
    attendees: List[str] = None
    recurrence: Optional[str] = None


@dataclass
class CalendarSyncResult:
    """Result of calendar sync operation."""
    success: bool
    events_created: int = 0
    events_updated: int = 0
    events_deleted: int = 0
    conflicts_resolved: int = 0
    errors: List[str] = None


class GoogleCalendarService:
    """Service for Google Calendar integration."""
    
    # OAuth 2.0 scopes required for calendar access
    SCOPES = [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events'
    ]
    
    def __init__(self):
        self.service = None
        self.credentials = None
    
    def get_authorization_url(self, tenant_id: uuid.UUID, user_id: uuid.UUID, redirect_uri: str) -> str:
        """Get Google OAuth authorization URL."""
        try:
            # Create OAuth flow
            flow = Flow.from_client_config(
                self._get_client_config(),
                scopes=self.SCOPES,
                redirect_uri=redirect_uri
            )
            
            # Generate authorization URL
            auth_url, state = flow.authorization_url(
                access_type='offline',
                include_granted_scopes='true',
                prompt='consent'
            )
            
            # Store state for verification
            self._store_oauth_state(tenant_id, user_id, state)
            
            return auth_url
            
        except Exception as e:
            raise Exception(f"Failed to generate authorization URL: {str(e)}")
    
    def handle_oauth_callback(self, tenant_id: uuid.UUID, user_id: uuid.UUID, 
                            authorization_code: str, redirect_uri: str) -> bool:
        """Handle OAuth callback and store credentials."""
        try:
            # Create OAuth flow
            flow = Flow.from_client_config(
                self._get_client_config(),
                scopes=self.SCOPES,
                redirect_uri=redirect_uri
            )
            
            # Exchange authorization code for credentials
            flow.fetch_token(code=authorization_code)
            credentials = flow.credentials
            
            # Store credentials securely
            self._store_credentials(tenant_id, user_id, credentials)
            
            # Initialize calendar service
            self._initialize_service(credentials)
            
            return True
            
        except Exception as e:
            raise Exception(f"Failed to handle OAuth callback: {str(e)}")
    
    def sync_staff_schedule_to_calendar(self, staff_profile_id: uuid.UUID, 
                                      tenant_id: uuid.UUID) -> CalendarSyncResult:
        """Sync staff work schedule to Google Calendar."""
        try:
            # Get staff profile and work schedules
            staff_profile = StaffProfile.query.filter_by(
                id=staff_profile_id,
                tenant_id=tenant_id
            ).first()
            
            if not staff_profile:
                return CalendarSyncResult(success=False, errors=["Staff profile not found"])
            
            # Get credentials for staff member
            credentials = self._get_credentials(tenant_id, staff_profile.membership.user_id)
            if not credentials:
                return CalendarSyncResult(success=False, errors=["No Google Calendar credentials found"])
            
            # Initialize service with credentials
            self._initialize_service(credentials)
            
            # Get work schedules
            work_schedules = WorkSchedule.query.filter_by(
                staff_profile_id=staff_profile_id,
                tenant_id=tenant_id
            ).all()
            
            if not work_schedules:
                return CalendarSyncResult(success=False, errors=["No work schedules found"])
            
            # Sync schedules to calendar
            result = self._sync_schedules_to_calendar(work_schedules, staff_profile)
            
            # Log sync event
            self._log_sync_event(tenant_id, staff_profile_id, result)
            
            return result
            
        except Exception as e:
            return CalendarSyncResult(success=False, errors=[f"Sync failed: {str(e)}"])
    
    def sync_calendar_to_schedule(self, staff_profile_id: uuid.UUID, 
                                tenant_id: uuid.UUID, 
                                start_date: datetime, 
                                end_date: datetime) -> CalendarSyncResult:
        """Sync Google Calendar events to work schedule."""
        try:
            # Get staff profile
            staff_profile = StaffProfile.query.filter_by(
                id=staff_profile_id,
                tenant_id=tenant_id
            ).first()
            
            if not staff_profile:
                return CalendarSyncResult(success=False, errors=["Staff profile not found"])
            
            # Get credentials
            credentials = self._get_credentials(tenant_id, staff_profile.membership.user_id)
            if not credentials:
                return CalendarSyncResult(success=False, errors=["No Google Calendar credentials found"])
            
            # Initialize service
            self._initialize_service(credentials)
            
            # Get calendar events
            events = self._get_calendar_events(start_date, end_date)
            
            # Convert events to work schedules
            result = self._convert_events_to_schedules(events, staff_profile_id, tenant_id)
            
            # Log sync event
            self._log_sync_event(tenant_id, staff_profile_id, result)
            
            return result
            
        except Exception as e:
            return CalendarSyncResult(success=False, errors=[f"Sync failed: {str(e)}"])
    
    def create_booking_event(self, staff_profile_id: uuid.UUID, tenant_id: uuid.UUID,
                           booking_data: Dict[str, Any]) -> bool:
        """Create a booking event in Google Calendar."""
        try:
            # Get staff profile
            staff_profile = StaffProfile.query.filter_by(
                id=staff_profile_id,
                tenant_id=tenant_id
            ).first()
            
            if not staff_profile:
                return False
            
            # Get credentials
            credentials = self._get_credentials(tenant_id, staff_profile.membership.user_id)
            if not credentials:
                return False
            
            # Initialize service
            self._initialize_service(credentials)
            
            # Create calendar event
            event = {
                'summary': booking_data.get('service_name', 'Booking'),
                'description': booking_data.get('description', ''),
                'start': {
                    'dateTime': booking_data['start_at'].isoformat(),
                    'timeZone': booking_data.get('timezone', 'UTC')
                },
                'end': {
                    'dateTime': booking_data['end_at'].isoformat(),
                    'timeZone': booking_data.get('timezone', 'UTC')
                },
                'location': booking_data.get('location', ''),
                'attendees': [
                    {'email': booking_data.get('customer_email', '')}
                ] if booking_data.get('customer_email') else []
            }
            
            # Insert event
            created_event = self.service.events().insert(
                calendarId='primary',
                body=event
            ).execute()
            
            return True
            
        except Exception as e:
            print(f"Failed to create booking event: {str(e)}")
            return False
    
    def _get_client_config(self) -> Dict[str, Any]:
        """Get Google OAuth client configuration."""
        # This should be loaded from environment variables or config
        return {
            "web": {
                "client_id": "your-client-id",
                "client_secret": "your-client-secret",
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": ["http://localhost:5000/auth/google/callback"]
            }
        }
    
    def _store_oauth_state(self, tenant_id: uuid.UUID, user_id: uuid.UUID, state: str):
        """Store OAuth state for verification."""
        # In production, this should be stored in Redis or database
        # For now, we'll use a simple in-memory store
        pass
    
    def _store_credentials(self, tenant_id: uuid.UUID, user_id: uuid.UUID, credentials: Credentials):
        """Store OAuth credentials securely."""
        # In production, credentials should be encrypted before storage
        credentials_data = {
            'token': credentials.token,
            'refresh_token': credentials.refresh_token,
            'token_uri': credentials.token_uri,
            'client_id': credentials.client_id,
            'client_secret': credentials.client_secret,
            'scopes': credentials.scopes
        }
        
        # Store in database (encrypted in production)
        # This is a simplified version - in production, use proper encryption
        encrypted_data = base64.b64encode(json.dumps(credentials_data).encode()).decode()
        
        # Update user record with encrypted credentials
        user = User.query.get(user_id)
        if user:
            # In production, store in a separate credentials table
            pass
    
    def _get_credentials(self, tenant_id: uuid.UUID, user_id: uuid.UUID) -> Optional[Credentials]:
        """Get stored OAuth credentials."""
        try:
            # In production, retrieve from encrypted storage
            # This is a simplified version
            return None
        except Exception:
            return None
    
    def _initialize_service(self, credentials: Credentials):
        """Initialize Google Calendar service with credentials."""
        try:
            # Refresh credentials if needed
            if credentials.expired and credentials.refresh_token:
                credentials.refresh(Request())
            
            # Build service
            self.service = build('calendar', 'v3', credentials=credentials)
            self.credentials = credentials
            
        except Exception as e:
            raise Exception(f"Failed to initialize calendar service: {str(e)}")
    
    def _sync_schedules_to_calendar(self, work_schedules: List[WorkSchedule], 
                                  staff_profile: StaffProfile) -> CalendarSyncResult:
        """Sync work schedules to Google Calendar."""
        events_created = 0
        events_updated = 0
        errors = []
        
        try:
            for schedule in work_schedules:
                if schedule.is_time_off:
                    continue  # Skip time off schedules
                
                # Create calendar event
                event = {
                    'summary': f"Work - {staff_profile.display_name}",
                    'description': f"Work schedule: {schedule.reason or 'Regular work hours'}",
                    'start': {
                        'dateTime': schedule.start_date.isoformat(),
                        'timeZone': 'UTC'
                    },
                    'end': {
                        'dateTime': (schedule.end_date or schedule.start_date + timedelta(hours=8)).isoformat(),
                        'timeZone': 'UTC'
                    }
                }
                
                # Add recurrence if specified
                if schedule.rrule:
                    event['recurrence'] = [schedule.rrule]
                
                # Insert or update event
                try:
                    if schedule.metadata_json and 'calendar_event_id' in schedule.metadata_json:
                        # Update existing event
                        self.service.events().update(
                            calendarId='primary',
                            eventId=schedule.metadata_json['calendar_event_id'],
                            body=event
                        ).execute()
                        events_updated += 1
                    else:
                        # Create new event
                        created_event = self.service.events().insert(
                            calendarId='primary',
                            body=event
                        ).execute()
                        
                        # Store event ID in schedule metadata
                        if not schedule.metadata_json:
                            schedule.metadata_json = {}
                        schedule.metadata_json['calendar_event_id'] = created_event['id']
                        events_created += 1
                        
                except HttpError as e:
                    errors.append(f"Failed to sync schedule {schedule.id}: {str(e)}")
            
            # Commit metadata updates
            db.session.commit()
            
            return CalendarSyncResult(
                success=len(errors) == 0,
                events_created=events_created,
                events_updated=events_updated,
                errors=errors
            )
            
        except Exception as e:
            return CalendarSyncResult(success=False, errors=[f"Sync failed: {str(e)}"])
    
    def _get_calendar_events(self, start_date: datetime, end_date: datetime) -> List[CalendarEvent]:
        """Get calendar events for date range."""
        try:
            events_result = self.service.events().list(
                calendarId='primary',
                timeMin=start_date.isoformat() + 'Z',
                timeMax=end_date.isoformat() + 'Z',
                singleEvents=True,
                orderBy='startTime'
            ).execute()
            
            events = []
            for item in events_result.get('items', []):
                event = CalendarEvent(
                    id=item['id'],
                    summary=item.get('summary', ''),
                    description=item.get('description', ''),
                    start=datetime.fromisoformat(item['start']['dateTime'].replace('Z', '+00:00')),
                    end=datetime.fromisoformat(item['end']['dateTime'].replace('Z', '+00:00')),
                    location=item.get('location', ''),
                    attendees=[att.get('email', '') for att in item.get('attendees', [])],
                    recurrence=item.get('recurrence', [None])[0] if item.get('recurrence') else None
                )
                events.append(event)
            
            return events
            
        except Exception as e:
            raise Exception(f"Failed to get calendar events: {str(e)}")
    
    def _convert_events_to_schedules(self, events: List[CalendarEvent], 
                                   staff_profile_id: uuid.UUID, 
                                   tenant_id: uuid.UUID) -> CalendarSyncResult:
        """Convert calendar events to work schedules."""
        schedules_created = 0
        errors = []
        
        try:
            for event in events:
                # Skip if this is a booking event (has attendees)
                if event.attendees:
                    continue
                
                # Create work schedule
                schedule = WorkSchedule(
                    id=uuid.uuid4(),
                    tenant_id=tenant_id,
                    staff_profile_id=staff_profile_id,
                    schedule_type='override',
                    start_date=event.start.date(),
                    end_date=event.end.date(),
                    work_hours={
                        'start_time': event.start.time().isoformat(),
                        'end_time': event.end.time().isoformat()
                    },
                    is_time_off=False,
                    overrides_regular=True,
                    reason=f"Imported from Google Calendar: {event.summary}",
                    metadata_json={
                        'calendar_event_id': event.id,
                        'imported_from_calendar': True
                    }
                )
                
                db.session.add(schedule)
                schedules_created += 1
            
            db.session.commit()
            
            return CalendarSyncResult(
                success=True,
                events_created=schedules_created,
                errors=errors
            )
            
        except Exception as e:
            return CalendarSyncResult(success=False, errors=[f"Conversion failed: {str(e)}"])
    
    def _log_sync_event(self, tenant_id: uuid.UUID, staff_profile_id: uuid.UUID, 
                       result: CalendarSyncResult):
        """Log calendar sync event for audit trail."""
        try:
            # Create audit log entry
            audit_log = AuditLog(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                table_name="calendar_sync",
                operation="SYNC",
                record_id=staff_profile_id,
                new_data={
                    "events_created": result.events_created,
                    "events_updated": result.events_updated,
                    "events_deleted": result.events_deleted,
                    "conflicts_resolved": result.conflicts_resolved,
                    "success": result.success,
                    "errors": result.errors
                }
            )
            
            db.session.add(audit_log)
            db.session.commit()
            
        except Exception as e:
            print(f"Failed to log sync event: {str(e)}")


class CalendarConflictResolver:
    """Resolves conflicts between work schedules and calendar events."""
    
    @staticmethod
    def detect_conflicts(work_schedules: List[WorkSchedule], 
                        calendar_events: List[CalendarEvent]) -> List[Dict[str, Any]]:
        """Detect conflicts between work schedules and calendar events."""
        conflicts = []
        
        for schedule in work_schedules:
            for event in calendar_events:
                # Check for time overlap
                if (schedule.start_date <= event.start.date() <= schedule.end_date and
                    schedule.start_date <= event.end.date() <= schedule.end_date):
                    
                    conflicts.append({
                        'schedule_id': schedule.id,
                        'event_id': event.id,
                        'conflict_type': 'time_overlap',
                        'schedule_time': f"{schedule.start_date} - {schedule.end_date}",
                        'event_time': f"{event.start} - {event.end}",
                        'description': f"Schedule conflicts with calendar event: {event.summary}"
                    })
        
        return conflicts
    
    @staticmethod
    def resolve_conflicts(conflicts: List[Dict[str, Any]], 
                         resolution_strategy: str = 'calendar_priority') -> List[Dict[str, Any]]:
        """Resolve conflicts using specified strategy."""
        resolved = []
        
        for conflict in conflicts:
            if resolution_strategy == 'calendar_priority':
                # Calendar events take priority - adjust work schedule
                resolved.append({
                    'conflict_id': conflict['schedule_id'],
                    'resolution': 'adjust_schedule',
                    'action': 'modify_work_schedule',
                    'reason': 'Calendar event takes priority'
                })
            elif resolution_strategy == 'schedule_priority':
                # Work schedule takes priority - create calendar event
                resolved.append({
                    'conflict_id': conflict['event_id'],
                    'resolution': 'create_calendar_event',
                    'action': 'add_to_calendar',
                    'reason': 'Work schedule takes priority'
                })
            elif resolution_strategy == 'manual':
                # Mark for manual resolution
                resolved.append({
                    'conflict_id': conflict['schedule_id'],
                    'resolution': 'manual_review',
                    'action': 'requires_human_intervention',
                    'reason': 'Complex conflict requiring manual resolution'
                })
        
        return resolved
