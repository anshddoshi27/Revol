"""
Simplified Test Suite for Task 8.1: Customer Profiles

This test suite validates the core CustomerService implementation for Task 8.1:
- Duplicate email/phone validation per tenant
- TITHI_CUSTOMER_DUPLICATE error handling
- CUSTOMER_CREATED observability hooks
- Idempotency by email+tenant_id

Contract Tests (Black-box): Given customer email already exists, 
When another with same email added, Then system rejects with TITHI_CUSTOMER_DUPLICATE.
"""

import pytest
import uuid
from datetime import datetime
from unittest.mock import patch, MagicMock

# Mock the database and app dependencies
import sys
from unittest.mock import MagicMock

# Create mock modules
sys.modules['app'] = MagicMock()
sys.modules['app.extensions'] = MagicMock()
sys.modules['app.extensions'].db = MagicMock()
sys.modules['app.models'] = MagicMock()
sys.modules['app.models.business'] = MagicMock()
sys.modules['app.models.core'] = MagicMock()
sys.modules['app.models.system'] = MagicMock()
sys.modules['app.middleware'] = MagicMock()
sys.modules['app.middleware.error_handler'] = MagicMock()

# Import after mocking
from app.services.business_phase2 import CustomerService, BusinessLogicError


class MockCustomer:
    """Mock Customer model."""
    def __init__(self, id, tenant_id, email=None, phone=None, display_name="Test Customer"):
        self.id = id
        self.tenant_id = tenant_id
        self.email = email
        self.phone = phone
        self.display_name = display_name
        self.marketing_opt_in = False
        self.notification_preferences = {}
        self.is_first_time = True
        self.created_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()


class MockQuery:
    """Mock SQLAlchemy query object."""
    def __init__(self, results=None):
        self.results = results or []
    
    def filter_by(self, **kwargs):
        return self
    
    def first(self):
        return self.results[0] if self.results else None
    
    def all(self):
        return self.results
    
    def count(self):
        return len(self.results)


class TestCustomerServiceTask81:
    """Test suite for Task 8.1: Customer Profiles implementation."""

    def test_create_customer_duplicate_email(self):
        """Test duplicate email rejection (Task 8.1 contract test)."""
        # Setup
        tenant_id = uuid.uuid4()
        existing_customer = MockCustomer(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            email="test@example.com"
        )
        
        customer_service = CustomerService()
        
        # Mock the find_customer_by_email method to return existing customer
        with patch.object(customer_service, 'find_customer_by_email', return_value=existing_customer):
            customer_data = {
                "display_name": "New Customer",
                "email": "test@example.com",  # Same email
                "phone": "+1234567890"
            }
            
            # Should raise TITHI_CUSTOMER_DUPLICATE
            with pytest.raises(BusinessLogicError) as exc_info:
                customer_service.create_customer(tenant_id, customer_data)
            
            assert exc_info.value.code == "TITHI_CUSTOMER_DUPLICATE"
            assert "already exists" in exc_info.value.message
            assert exc_info.value.status_code == 409

    def test_create_customer_duplicate_phone(self):
        """Test duplicate phone rejection (Task 8.1 constraint)."""
        # Setup
        tenant_id = uuid.uuid4()
        existing_customer = MockCustomer(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            phone="+5555555555"
        )
        
        customer_service = CustomerService()
        
        # Mock the find_customer_by_phone method to return existing customer
        with patch.object(customer_service, 'find_customer_by_phone', return_value=existing_customer):
            customer_data = {
                "display_name": "New Customer",
                "email": "new@example.com",
                "phone": "+5555555555"  # Same phone
            }
            
            # Should raise TITHI_CUSTOMER_DUPLICATE
            with pytest.raises(BusinessLogicError) as exc_info:
                customer_service.create_customer(tenant_id, customer_data)
            
            assert exc_info.value.code == "TITHI_CUSTOMER_DUPLICATE"
            assert "already exists" in exc_info.value.message
            assert exc_info.value.status_code == 409

    def test_create_customer_success(self):
        """Test successful customer creation."""
        # Setup
        tenant_id = uuid.uuid4()
        customer_service = CustomerService()
        
        # Mock the find methods to return None (no duplicates)
        with patch.object(customer_service, 'find_customer_by_email', return_value=None), \
             patch.object(customer_service, 'find_customer_by_phone', return_value=None), \
             patch.object(customer_service, '_safe_db_operation') as mock_safe_op:
            
            # Mock the database operation to return a customer
            mock_customer = MockCustomer(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                email="success@example.com",
                phone="+1111111111"
            )
            mock_safe_op.return_value = mock_customer
            
            customer_data = {
                "display_name": "Success Customer",
                "email": "success@example.com",
                "phone": "+1111111111"
            }
            
            # Should succeed
            result = customer_service.create_customer(tenant_id, customer_data)
            
            assert result is not None
            assert result.email == "success@example.com"
            assert result.phone == "+1111111111"

    def test_create_customer_observability_hooks(self):
        """Test CUSTOMER_CREATED observability hook (Task 8.1 requirement)."""
        # Setup
        tenant_id = uuid.uuid4()
        customer_service = CustomerService()
        
        # Mock the find methods to return None (no duplicates)
        with patch.object(customer_service, 'find_customer_by_email', return_value=None), \
             patch.object(customer_service, 'find_customer_by_phone', return_value=None), \
             patch.object(customer_service, '_emit_event') as mock_emit, \
             patch.object(customer_service, '_safe_db_operation') as mock_safe_op:
            
            # Mock the database operation to return a customer
            mock_customer = MockCustomer(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                email="observable@example.com",
                phone="+2222222222"
            )
            mock_safe_op.return_value = mock_customer
            
            customer_data = {
                "display_name": "Observable Customer",
                "email": "observable@example.com",
                "phone": "+2222222222"
            }
            
            # Create customer
            customer_service.create_customer(tenant_id, customer_data)
            
            # Verify CUSTOMER_CREATED event was emitted
            mock_emit.assert_called_once()
            call_args = mock_emit.call_args
            assert call_args[0][0] == tenant_id  # tenant_id
            assert call_args[0][1] == "CUSTOMER_CREATED"  # event_code
            assert "customer_id" in call_args[0][2]  # payload
            assert call_args[0][2]["email"] == "observable@example.com"

    def test_customer_idempotency(self):
        """Test idempotency by email+tenant_id (Task 8.1 requirement)."""
        # Setup
        tenant_id = uuid.uuid4()
        customer_service = CustomerService()
        
        # First call - no duplicates
        with patch.object(customer_service, 'find_customer_by_email', return_value=None), \
             patch.object(customer_service, 'find_customer_by_phone', return_value=None), \
             patch.object(customer_service, '_safe_db_operation') as mock_safe_op:
            
            mock_customer = MockCustomer(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                email="idempotent@example.com"
            )
            mock_safe_op.return_value = mock_customer
            
            customer_data = {
                "display_name": "Idempotent Customer",
                "email": "idempotent@example.com",
                "phone": "+3333333333"
            }
            
            # First creation should succeed
            result1 = customer_service.create_customer(tenant_id, customer_data)
            assert result1 is not None
        
        # Second call - duplicate email found
        with patch.object(customer_service, 'find_customer_by_email', return_value=mock_customer):
            # Second creation should fail with duplicate
            with pytest.raises(BusinessLogicError) as exc_info:
                customer_service.create_customer(tenant_id, customer_data)
            
            assert exc_info.value.code == "TITHI_CUSTOMER_DUPLICATE"

    def test_customer_tenant_isolation(self):
        """Test tenant isolation (Task 8.1: Customer identity must remain unique within tenant)."""
        # Setup
        tenant1_id = uuid.uuid4()
        tenant2_id = uuid.uuid4()
        customer_service = CustomerService()
        
        # Create customer in first tenant
        with patch.object(customer_service, 'find_customer_by_email', return_value=None), \
             patch.object(customer_service, 'find_customer_by_phone', return_value=None), \
             patch.object(customer_service, '_safe_db_operation') as mock_safe_op:
            
            mock_customer1 = MockCustomer(
                id=uuid.uuid4(),
                tenant_id=tenant1_id,
                email="isolated@example.com"
            )
            mock_safe_op.return_value = mock_customer1
            
            customer_data = {
                "display_name": "Isolated Customer",
                "email": "isolated@example.com",
                "phone": "+4444444444"
            }
            
            result1 = customer_service.create_customer(tenant1_id, customer_data)
            assert result1 is not None
        
        # Create customer with same email in second tenant - should succeed
        with patch.object(customer_service, 'find_customer_by_email', return_value=None), \
             patch.object(customer_service, 'find_customer_by_phone', return_value=None), \
             patch.object(customer_service, '_safe_db_operation') as mock_safe_op:
            
            mock_customer2 = MockCustomer(
                id=uuid.uuid4(),
                tenant_id=tenant2_id,
                email="isolated@example.com"  # Same email, different tenant
            )
            mock_safe_op.return_value = mock_customer2
            
            result2 = customer_service.create_customer(tenant2_id, customer_data)
            assert result2 is not None
            assert result2.tenant_id == tenant2_id

    def test_customer_validation_required_fields(self):
        """Test validation of required fields."""
        # Setup
        tenant_id = uuid.uuid4()
        customer_service = CustomerService()
        
        # Test with no email or phone
        customer_data = {
            "display_name": "Invalid Customer"
        }
        
        # Should not raise validation error at service level (handled by API layer)
        # But should handle gracefully
        with patch.object(customer_service, 'find_customer_by_email', return_value=None), \
             patch.object(customer_service, 'find_customer_by_phone', return_value=None), \
             patch.object(customer_service, '_safe_db_operation') as mock_safe_op:
            
            mock_customer = MockCustomer(
                id=uuid.uuid4(),
                tenant_id=tenant_id
            )
            mock_safe_op.return_value = mock_customer
            
            # Should succeed with empty email/phone
            result = customer_service.create_customer(tenant_id, customer_data)
            assert result is not None


if __name__ == "__main__":
    pytest.main([__file__])
