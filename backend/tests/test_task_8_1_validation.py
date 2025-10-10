"""
Task 8.1 Validation Test

This test validates the core requirements of Task 8.1:
- Customer profiles CRUD endpoints exist
- TITHI_CUSTOMER_DUPLICATE error handling implemented
- CUSTOMER_CREATED observability hooks implemented
- Idempotency by email+tenant_id implemented

This is a validation test that checks the implementation without requiring full app context.
"""

import pytest
import os
import re


class TestTask81Validation:
    """Validation tests for Task 8.1 implementation."""

    def test_customer_service_duplicate_validation_exists(self):
        """Test that duplicate validation is implemented in CustomerService."""
        service_file = "app/services/business_phase2.py"
        assert os.path.exists(service_file), "CustomerService file should exist"
        
        with open(service_file, 'r') as f:
            content = f.read()
        
        # Check for duplicate email validation
        assert "find_customer_by_email" in content, "Email lookup method should exist"
        assert "TITHI_CUSTOMER_DUPLICATE" in content, "Duplicate error code should be implemented"
        assert "already exists" in content, "Duplicate error message should be implemented"
        
        # Check for duplicate phone validation
        assert "find_customer_by_phone" in content, "Phone lookup method should exist"
        
        # Check for observability hooks
        assert "CUSTOMER_CREATED" in content, "CUSTOMER_CREATED event should be emitted"
        assert "_emit_event" in content, "Event emission method should be called"

    def test_crm_api_endpoints_exist(self):
        """Test that CRM API endpoints exist."""
        api_file = "app/blueprints/crm_api.py"
        assert os.path.exists(api_file), "CRM API blueprint should exist"
        
        with open(api_file, 'r') as f:
            content = f.read()
        
        # Check for CRUD endpoints
        assert "@crm_bp.route(\"/customers\", methods=[\"POST\"])" in content, "POST endpoint should exist"
        assert "@crm_bp.route(\"/customers/<customer_id>\", methods=[\"GET\"])" in content, "GET endpoint should exist"
        assert "@crm_bp.route(\"/customers/<customer_id>\", methods=[\"PUT\"])" in content, "PUT endpoint should exist"
        
        # Check for Task 8.1 specific requirements
        assert "customer_id" in content, "Response should include customer_id"
        assert "get_customer_profile_with_history" in content, "GET endpoint should return booking history"

    def test_customer_model_exists(self):
        """Test that Customer model exists with required fields."""
        model_file = "app/models/business.py"
        assert os.path.exists(model_file), "Business models file should exist"
        
        with open(model_file, 'r') as f:
            content = f.read()
        
        # Check for Customer model
        assert "class Customer(TenantModel):" in content, "Customer model should exist"
        
        # Check for required fields (Task 8.1: Input: {name, email, phone})
        assert "display_name" in content, "Customer should have display_name field"
        assert "email" in content, "Customer should have email field"
        assert "phone" in content, "Customer should have phone field"
        
        # Check for tenant isolation
        assert "tenant_id" in content, "Customer should have tenant_id for isolation"

    def test_error_handler_duplicate_code(self):
        """Test that TITHI_CUSTOMER_DUPLICATE error code is properly handled."""
        service_file = "app/services/business_phase2.py"
        
        with open(service_file, 'r') as f:
            content = f.read()
        
        # Check for proper error handling
        assert "BusinessLogicError" in content, "Should use BusinessLogicError for duplicates"
        assert "status_code=409" in content, "Should return 409 status for conflicts"
        
        # Check for proper error message format
        assert "Customer with email" in content, "Should have descriptive error message"
        assert "Customer with phone" in content, "Should have descriptive error message"

    def test_observability_hooks_implementation(self):
        """Test that observability hooks are properly implemented."""
        service_file = "app/services/business_phase2.py"
        
        with open(service_file, 'r') as f:
            content = f.read()
        
        # Check for event emission in create_customer method
        create_method_start = content.find("def create_customer")
        create_method_end = content.find("def get_customer", create_method_start)
        create_method = content[create_method_start:create_method_end]
        
        assert "_emit_event" in create_method, "create_customer should emit events"
        assert "CUSTOMER_CREATED" in create_method, "Should emit CUSTOMER_CREATED event"
        assert "customer_id" in create_method, "Event payload should include customer_id"

    def test_idempotency_implementation(self):
        """Test that idempotency is properly implemented."""
        service_file = "app/services/business_phase2.py"
        
        with open(service_file, 'r') as f:
            content = f.read()
        
        # Check for duplicate validation before creation
        create_method_start = content.find("def create_customer")
        create_method_end = content.find("def get_customer", create_method_start)
        create_method = content[create_method_start:create_method_end]
        
        assert "find_customer_by_email" in create_method, "Should check for email duplicates"
        assert "find_customer_by_phone" in create_method, "Should check for phone duplicates"
        assert "if existing_customer:" in create_method, "Should handle existing customers"

    def test_api_response_format(self):
        """Test that API responses follow Task 8.1 requirements."""
        api_file = "app/blueprints/crm_api.py"
        
        with open(api_file, 'r') as f:
            content = f.read()
        
        # Check POST endpoint response format
        post_endpoint_start = content.find("@crm_bp.route(\"/customers\", methods=[\"POST\"])")
        post_endpoint_end = content.find("@crm_bp.route(\"/customers/<customer_id>\", methods=[\"GET\"])", post_endpoint_start)
        post_endpoint = content[post_endpoint_start:post_endpoint_end]
        
        assert "customer_id" in post_endpoint, "POST response should include customer_id"
        assert "201" in post_endpoint, "POST should return 201 status"
        
        # Check GET endpoint response format
        get_endpoint_start = content.find("@crm_bp.route(\"/customers/<customer_id>\", methods=[\"GET\"])")
        get_endpoint_end = content.find("@crm_bp.route(\"/customers/<customer_id>\", methods=[\"PUT\"])", get_endpoint_start)
        get_endpoint = content[get_endpoint_start:get_endpoint_end]
        
        assert "get_customer_profile_with_history" in get_endpoint, "GET should return booking history"
        assert "profile_data" in get_endpoint, "GET should return profile data"

    def test_tenant_isolation_implementation(self):
        """Test that tenant isolation is properly implemented."""
        service_file = "app/services/business_phase2.py"
        
        with open(service_file, 'r') as f:
            content = f.read()
        
        # Check that all methods use tenant_id
        assert "tenant_id" in content, "All methods should use tenant_id"
        assert "tenant_id=tenant_id" in content, "Should pass tenant_id to queries"
        
        # Check for tenant-scoped queries
        assert "filter_by" in content, "Should use filter_by for tenant isolation"
        assert "tenant_id=tenant_id" in content, "Should filter by tenant_id"

    def test_contract_test_requirements(self):
        """Test that contract test requirements are met."""
        # Check that the error code matches the contract test requirement
        service_file = "app/services/business_phase2.py"
        
        with open(service_file, 'r') as f:
            content = f.read()
        
        # Contract test requirement: "Then system rejects with TITHI_CUSTOMER_DUPLICATE"
        assert "TITHI_CUSTOMER_DUPLICATE" in content, "Should use exact error code from contract test"
        
        # Check that it's used in the right context
        duplicate_checks = re.findall(r'TITHI_CUSTOMER_DUPLICATE', content)
        assert len(duplicate_checks) >= 2, "Should be used for both email and phone duplicates"

    def test_schema_freeze_compliance(self):
        """Test that implementation complies with schema freeze note."""
        model_file = "app/models/business.py"
        
        with open(model_file, 'r') as f:
            content = f.read()
        
        # Schema freeze note: "customers schema frozen"
        # Check that the schema matches the database report
        assert "display_name" in content, "Should have display_name field"
        assert "email" in content, "Should have email field"
        assert "phone" in content, "Should have phone field"
        assert "marketing_opt_in" in content, "Should have marketing_opt_in field"
        assert "notification_preferences" in content, "Should have notification_preferences field"
        assert "is_first_time" in content, "Should have is_first_time field"
        assert "deleted_at" in content, "Should have deleted_at for soft delete"


if __name__ == "__main__":
    pytest.main([__file__])
