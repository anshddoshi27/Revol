"""
Test Task 8.3: Notes & Interactions

Contract Tests (Black-box): Given staff adds a note, When customer fetches their profile, Then note not visible.
North-Star Invariants: Notes must never be exposed to customers
"""

import pytest
import uuid
from datetime import datetime, timedelta
from unittest.mock import patch

from app import create_app
from app.extensions import db
from app.models.business import Customer
from app.models.core import Tenant
from app.models.crm import CustomerNote
from app.models.core import User, Membership
from app.middleware.error_handler import TithiError


class TestCustomerNotesTask83:
    """Test suite for Task 8.3: Notes & Interactions"""
    
    @pytest.fixture
    def app(self):
        app = create_app('testing')
        with app.app_context():
            db.create_all()
            yield app
            db.drop_all()
    
    @pytest.fixture
    def client(self, app):
        return app.test_client()
    
    @pytest.fixture
    def test_tenant(self, app):
        with app.app_context():
            tenant = Tenant(
                id=uuid.uuid4(),
                slug='test-tenant',
                tz='UTC'
            )
            db.session.add(tenant)
            db.session.commit()
            return tenant
    
    @pytest.fixture
    def test_user(self, app):
        with app.app_context():
            user = User(
                id=uuid.uuid4(),
                display_name='Test Staff',
                primary_email='staff@test.com'
            )
            db.session.add(user)
            db.session.commit()
            return user
    
    @pytest.fixture
    def test_customer(self, app, test_tenant):
        with app.app_context():
            customer = Customer(
                id=uuid.uuid4(),
                tenant_id=test_tenant.id,
                display_name='Test Customer',
                email='customer@test.com',
                phone='+1234567890'
            )
            db.session.add(customer)
            db.session.commit()
            return customer
    
    @pytest.fixture
    def auth_headers(self, test_user, test_tenant):
        """Mock auth headers for testing"""
        return {
            'Authorization': f'Bearer mock-jwt-token',
            'X-Tenant-ID': str(test_tenant.id),
            'X-User-ID': str(test_user.id)
        }
    
    def test_add_customer_note_success(self, client, test_tenant, test_customer, test_user, auth_headers):
        """Test successful note addition (Task 8.3: Input: {note, staff_id}, Output: note_id)"""
        with patch('app.middleware.auth_middleware.get_current_user') as mock_user:
            mock_user.return_value = test_user
            
            response = client.post(
                f'/v1/tenants/{test_tenant.id}/customers/{test_customer.id}/notes',
                json={'content': 'Customer prefers morning appointments'},
                headers=auth_headers
            )
            
            assert response.status_code == 201
            data = response.get_json()
            
            # Task 8.3: Output: note_id
            assert 'note_id' in data
            assert 'note' in data
            assert data['note']['content'] == 'Customer prefers morning appointments'
            assert data['note']['created_by'] == str(test_user.id)
    
    def test_add_customer_note_empty_content_rejected(self, client, test_tenant, test_customer, test_user, auth_headers):
        """Test empty notes are rejected (Task 8.3: Validation: Empty notes rejected)"""
        with patch('app.middleware.auth_middleware.get_current_user') as mock_user:
            mock_user.return_value = test_user
            
            # Test empty content
            response = client.post(
                f'/v1/tenants/{test_tenant.id}/customers/{test_customer.id}/notes',
                json={'content': ''},
                headers=auth_headers
            )
            
            assert response.status_code == 422
            data = response.get_json()
            assert data['code'] == 'TITHI_NOTE_INVALID'
            
            # Test whitespace-only content
            response = client.post(
                f'/v1/tenants/{test_tenant.id}/customers/{test_customer.id}/notes',
                json={'content': '   '},
                headers=auth_headers
            )
            
            assert response.status_code == 422
            data = response.get_json()
            assert data['code'] == 'TITHI_NOTE_INVALID'
    
    def test_get_customer_notes_retrievable_by_staff(self, client, test_tenant, test_customer, test_user, auth_headers):
        """Test notes are retrievable by staff (Task 8.3: Testing: Notes retrievable by staff)"""
        with patch('app.middleware.auth_middleware.get_current_user') as mock_user:
            mock_user.return_value = test_user
            
            # Add a note first
            client.post(
                f'/v1/tenants/{test_tenant.id}/customers/{test_customer.id}/notes',
                json={'content': 'Customer prefers morning appointments'},
                headers=auth_headers
            )
            
            # Get notes
            response = client.get(
                f'/v1/tenants/{test_tenant.id}/customers/{test_customer.id}/notes',
                headers=auth_headers
            )
            
            assert response.status_code == 200
            data = response.get_json()
            assert 'notes' in data
            assert len(data['notes']) == 1
            assert data['notes'][0]['content'] == 'Customer prefers morning appointments'
    
    def test_notes_private_to_tenant_staff(self, client, test_tenant, test_customer, test_user, auth_headers):
        """Test notes are private to tenant staff (Task 8.3: Constraints: Notes private to tenant staff)"""
        with patch('app.middleware.auth_middleware.get_current_user') as mock_user:
            mock_user.return_value = test_user
            
            # Add a note
            client.post(
                f'/v1/tenants/{test_tenant.id}/customers/{test_customer.id}/notes',
                json={'content': 'Customer prefers morning appointments'},
                headers=auth_headers
            )
            
            # Create another tenant
            other_tenant = Tenant(
                id=uuid.uuid4(),
                slug='other-tenant',
                tz='UTC'
            )
            db.session.add(other_tenant)
            db.session.commit()
            
            # Try to access notes from different tenant
            other_auth_headers = {
                'Authorization': f'Bearer mock-jwt-token',
                'X-Tenant-ID': str(other_tenant.id),
                'X-User-ID': str(test_user.id)
            }
            
            response = client.get(
                f'/v1/tenants/{other_tenant.id}/customers/{test_customer.id}/notes',
                headers=other_auth_headers
            )
            
            # Should not see notes from other tenant
            assert response.status_code == 200
            data = response.get_json()
            assert len(data['notes']) == 0
    
    def test_contract_test_notes_not_visible_to_customers(self, client, test_tenant, test_customer, test_user, auth_headers):
        """Contract Tests (Black-box): Given staff adds a note, When customer fetches their profile, Then note not visible."""
        with patch('app.middleware.auth_middleware.get_current_user') as mock_user:
            mock_user.return_value = test_user
            
            # Staff adds a note
            client.post(
                f'/v1/tenants/{test_tenant.id}/customers/{test_customer.id}/notes',
                json={'content': 'Customer prefers morning appointments'},
                headers=auth_headers
            )
            
            # Customer fetches their profile (simulate customer access)
            # Note: In the actual system, customers don't have API access, but this test
            # verifies that notes are not included in customer profile data
            response = client.get(
                f'/v1/tenants/{test_tenant.id}/customers/{test_customer.id}',
                headers=auth_headers
            )
            
            assert response.status_code == 200
            data = response.get_json()
            
            # Verify note is not visible in customer profile
            # (North-Star Invariants: Notes must never be exposed to customers)
            assert 'notes' not in data
            assert 'customer' in data or 'profile' in data
    
    def test_idempotency_by_customer_staff_content_timestamp(self, client, test_tenant, test_customer, test_user, auth_headers):
        """Test idempotency by {customer_id, note_text, staff_id, timestamp} (Task 8.3 requirement)"""
        with patch('app.middleware.auth_middleware.get_current_user') as mock_user:
            mock_user.return_value = test_user
            
            content = 'Customer prefers morning appointments'
            
            # Add same note twice within 1 minute
            response1 = client.post(
                f'/v1/tenants/{test_tenant.id}/customers/{test_customer.id}/notes',
                json={'content': content},
                headers=auth_headers
            )
            
            response2 = client.post(
                f'/v1/tenants/{test_tenant.id}/customers/{test_customer.id}/notes',
                json={'content': content},
                headers=auth_headers
            )
            
            assert response1.status_code == 201
            assert response2.status_code == 201
            
            # Both should return the same note_id (idempotency)
            data1 = response1.get_json()
            data2 = response2.get_json()
            assert data1['note_id'] == data2['note_id']
    
    def test_note_added_observability_hook(self, client, test_tenant, test_customer, test_user, auth_headers):
        """Test NOTE_ADDED observability hook is emitted (Task 8.3 requirement)"""
        with patch('app.middleware.auth_middleware.get_current_user') as mock_user:
            mock_user.return_value = test_user
            
            with patch('app.blueprints.crm_api.logger') as mock_logger:
                response = client.post(
                    f'/v1/tenants/{test_tenant.id}/customers/{test_customer.id}/notes',
                    json={'content': 'Customer prefers morning appointments'},
                    headers=auth_headers
                )
                
                assert response.status_code == 201
                
                # Verify NOTE_ADDED hook was emitted
                mock_logger.info.assert_called()
                log_calls = [call[0][0] for call in mock_logger.info.call_args_list]
                note_added_calls = [call for call in log_calls if 'NOTE_ADDED:' in call]
                assert len(note_added_calls) == 1
                assert 'tenant_id=' in note_added_calls[0]
                assert 'customer_id=' in note_added_calls[0]
                assert 'note_id=' in note_added_calls[0]
                assert 'created_by=' in note_added_calls[0]
    
    def test_note_created_by_staff_id(self, client, test_tenant, test_customer, test_user, auth_headers):
        """Test note is created by staff_id (Task 8.3: Input: {note, staff_id})"""
        with patch('app.middleware.auth_middleware.get_current_user') as mock_user:
            mock_user.return_value = test_user
            
            response = client.post(
                f'/v1/tenants/{test_tenant.id}/customers/{test_customer.id}/notes',
                json={'content': 'Customer prefers morning appointments'},
                headers=auth_headers
            )
            
            assert response.status_code == 201
            data = response.get_json()
            assert data['note']['created_by'] == str(test_user.id)
    
    def test_customer_notes_table_structure(self, app, test_tenant, test_customer, test_user):
        """Test customer_notes table structure (Task 8.3: customer_notes table)"""
        with app.app_context():
            note = CustomerNote(
                id=uuid.uuid4(),
                tenant_id=test_tenant.id,
                customer_id=test_customer.id,
                content='Test note content',
                created_by=test_user.id
            )
            db.session.add(note)
            db.session.commit()
            
            # Verify table structure
            assert note.id is not None
            assert note.tenant_id == test_tenant.id
            assert note.customer_id == test_customer.id
            assert note.content == 'Test note content'
            assert note.created_by == test_user.id
            assert note.created_at is not None
            assert note.updated_at is not None
    
    def test_note_endpoints_exist(self, client, test_tenant, test_customer, auth_headers):
        """Test /customers/{id}/notes endpoints exist (Task 8.3 requirement)"""
        # Test GET endpoint exists
        response = client.get(
            f'/v1/tenants/{test_tenant.id}/customers/{test_customer.id}/notes',
            headers=auth_headers
        )
        assert response.status_code in [200, 401]  # 401 if no auth, 200 if auth works
        
        # Test POST endpoint exists
        response = client.post(
            f'/v1/tenants/{test_tenant.id}/customers/{test_customer.id}/notes',
            json={'content': 'test'},
            headers=auth_headers
        )
        assert response.status_code in [201, 401, 422]  # 401 if no auth, 201 if success, 422 if validation fails
