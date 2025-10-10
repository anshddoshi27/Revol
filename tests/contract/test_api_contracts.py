"""
API Contract Testing Suite
Validates API contracts between frontend and backend
"""

import pytest
import json
from typing import Dict, Any, List
from dataclasses import dataclass
from datetime import datetime
import uuid


@dataclass
class ContractTest:
    """Contract test definition."""
    endpoint: str
    method: str
    request_schema: Dict[str, Any]
    response_schema: Dict[str, Any]
    status_code: int
    description: str


class APIContractValidator:
    """Validates API contracts against schemas."""
    
    def __init__(self):
        self.contracts: List[ContractTest] = []
        self._define_contracts()
    
    def _define_contracts(self):
        """Define all API contracts."""
        
        # Health endpoint contract
        self.contracts.append(ContractTest(
            endpoint="/health/live",
            method="GET",
            request_schema={},
            response_schema={
                "type": "object",
                "properties": {
                    "status": {"type": "string", "enum": ["healthy"]},
                    "timestamp": {"type": "string", "format": "date-time"},
                    "version": {"type": "string"}
                },
                "required": ["status", "timestamp"]
            },
            status_code=200,
            description="Health check endpoint"
        ))
        
        # Tenant bootstrap contract
        self.contracts.append(ContractTest(
            endpoint="/v1/b/{slug}",
            method="GET",
            request_schema={},
            response_schema={
                "type": "object",
                "properties": {
                    "tenant": {
                        "type": "object",
                        "properties": {
                            "id": {"type": "string", "format": "uuid"},
                            "slug": {"type": "string"},
                            "tz": {"type": "string"},
                            "trust_copy_json": {"type": "object"},
                            "billing_json": {"type": "object"}
                        },
                        "required": ["id", "slug", "tz"]
                    },
                    "services": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "id": {"type": "string", "format": "uuid"},
                                "name": {"type": "string"},
                                "slug": {"type": "string"},
                                "description": {"type": "string"},
                                "duration_min": {"type": "integer"},
                                "price_cents": {"type": "integer"},
                                "category": {"type": "string"}
                            },
                            "required": ["id", "name", "slug", "duration_min", "price_cents"]
                        }
                    },
                    "theme": {
                        "type": "object",
                        "properties": {
                            "brand_color": {"type": "string"},
                            "logo_url": {"type": "string"},
                            "theme_json": {"type": "object"}
                        }
                    }
                },
                "required": ["tenant", "services", "theme"]
            },
            status_code=200,
            description="Tenant bootstrap endpoint"
        ))
        
        # Booking creation contract
        self.contracts.append(ContractTest(
            endpoint="/api/tenants/{tenant_id}/bookings",
            method="POST",
            request_schema={
                "type": "object",
                "properties": {
                    "client_generated_id": {"type": "string"},
                    "service_id": {"type": "string", "format": "uuid"},
                    "customer_id": {"type": "string", "format": "uuid"},
                    "start_at": {"type": "string", "format": "date-time"},
                    "end_at": {"type": "string", "format": "date-time"},
                    "booking_tz": {"type": "string"}
                },
                "required": ["client_generated_id", "service_id", "customer_id", "start_at", "end_at", "booking_tz"]
            },
            response_schema={
                "type": "object",
                "properties": {
                    "id": {"type": "string", "format": "uuid"},
                    "tenant_id": {"type": "string", "format": "uuid"},
                    "customer_id": {"type": "string", "format": "uuid"},
                    "service_id": {"type": "string", "format": "uuid"},
                    "start_at": {"type": "string", "format": "date-time"},
                    "end_at": {"type": "string", "format": "date-time"},
                    "status": {"type": "string", "enum": ["pending", "confirmed", "checked_in", "completed", "canceled", "no_show", "failed"]},
                    "created_at": {"type": "string", "format": "date-time"}
                },
                "required": ["id", "tenant_id", "customer_id", "service_id", "start_at", "end_at", "status", "created_at"]
            },
            status_code=201,
            description="Booking creation endpoint"
        ))
        
        # Availability query contract
        self.contracts.append(ContractTest(
            endpoint="/api/availability",
            method="GET",
            request_schema={
                "type": "object",
                "properties": {
                    "service_id": {"type": "string", "format": "uuid"},
                    "date_from": {"type": "string", "format": "date-time"},
                    "date_to": {"type": "string", "format": "date-time"},
                    "tz": {"type": "string"}
                },
                "required": ["service_id", "date_from", "date_to", "tz"]
            },
            response_schema={
                "type": "object",
                "properties": {
                    "slots": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "start_at": {"type": "string", "format": "date-time"},
                                "end_at": {"type": "string", "format": "date-time"},
                                "resource_id": {"type": "string", "format": "uuid"},
                                "available": {"type": "boolean"}
                            },
                            "required": ["start_at", "end_at", "resource_id", "available"]
                        }
                    }
                },
                "required": ["slots"]
            },
            status_code=200,
            description="Availability query endpoint"
        ))
    
    def validate_schema(self, data: Dict[str, Any], schema: Dict[str, Any]) -> List[str]:
        """Validate data against JSON schema."""
        errors = []
        
        # Basic type validation
        if schema.get("type") == "object":
            if not isinstance(data, dict):
                errors.append(f"Expected object, got {type(data).__name__}")
                return errors
            
            # Check required fields
            required_fields = schema.get("required", [])
            for field in required_fields:
                if field not in data:
                    errors.append(f"Missing required field: {field}")
            
            # Validate properties
            properties = schema.get("properties", {})
            for field, value in data.items():
                if field in properties:
                    field_schema = properties[field]
                    field_errors = self.validate_schema(value, field_schema)
                    errors.extend([f"{field}.{error}" for error in field_errors])
        
        elif schema.get("type") == "array":
            if not isinstance(data, list):
                errors.append(f"Expected array, got {type(data).__name__}")
                return errors
            
            items_schema = schema.get("items", {})
            for i, item in enumerate(data):
                item_errors = self.validate_schema(item, items_schema)
                errors.extend([f"[{i}].{error}" for error in item_errors])
        
        elif schema.get("type") == "string":
            if not isinstance(data, str):
                errors.append(f"Expected string, got {type(data).__name__}")
            
            # Validate format
            if schema.get("format") == "uuid":
                try:
                    uuid.UUID(data)
                except ValueError:
                    errors.append("Invalid UUID format")
            
            elif schema.get("format") == "date-time":
                try:
                    datetime.fromisoformat(data.replace('Z', '+00:00'))
                except ValueError:
                    errors.append("Invalid date-time format")
        
        elif schema.get("type") == "integer":
            if not isinstance(data, int):
                errors.append(f"Expected integer, got {type(data).__name__}")
        
        elif schema.get("type") == "boolean":
            if not isinstance(data, bool):
                errors.append(f"Expected boolean, got {type(data).__name__}")
        
        # Validate enum values
        if "enum" in schema:
            if data not in schema["enum"]:
                errors.append(f"Value must be one of {schema['enum']}, got {data}")
        
        return errors


class TestAPIContracts:
    """Test suite for API contract validation."""
    
    def setup_method(self):
        """Setup test method."""
        self.validator = APIContractValidator()
    
    def test_health_endpoint_contract(self):
        """Test health endpoint contract."""
        contract = next(c for c in self.validator.contracts if c.endpoint == "/health/live")
        
        # Valid response
        valid_response = {
            "status": "healthy",
            "timestamp": "2025-01-27T10:00:00Z",
            "version": "1.0.0"
        }
        
        errors = self.validator.validate_schema(valid_response, contract.response_schema)
        assert len(errors) == 0, f"Valid response failed validation: {errors}"
        
        # Invalid response
        invalid_response = {
            "status": "unhealthy",  # Invalid enum value
            "timestamp": "invalid-date"  # Invalid date format
        }
        
        errors = self.validator.validate_schema(invalid_response, contract.response_schema)
        assert len(errors) > 0, "Invalid response should fail validation"
    
    def test_tenant_bootstrap_contract(self):
        """Test tenant bootstrap contract."""
        contract = next(c for c in self.validator.contracts if c.endpoint == "/v1/b/{slug}")
        
        # Valid response
        valid_response = {
            "tenant": {
                "id": str(uuid.uuid4()),
                "slug": "test-tenant",
                "tz": "UTC",
                "trust_copy_json": {},
                "billing_json": {}
            },
            "services": [
                {
                    "id": str(uuid.uuid4()),
                    "name": "Test Service",
                    "slug": "test-service",
                    "description": "A test service",
                    "duration_min": 60,
                    "price_cents": 5000,
                    "category": "test"
                }
            ],
            "theme": {
                "brand_color": "#000000",
                "logo_url": "https://example.com/logo.png",
                "theme_json": {}
            }
        }
        
        errors = self.validator.validate_schema(valid_response, contract.response_schema)
        assert len(errors) == 0, f"Valid response failed validation: {errors}"
    
    def test_booking_creation_contract(self):
        """Test booking creation contract."""
        contract = next(c for c in self.validator.contracts if c.endpoint == "/api/tenants/{tenant_id}/bookings")
        
        # Valid request
        valid_request = {
            "client_generated_id": str(uuid.uuid4()),
            "service_id": str(uuid.uuid4()),
            "customer_id": str(uuid.uuid4()),
            "start_at": "2025-01-28T10:00:00Z",
            "end_at": "2025-01-28T11:00:00Z",
            "booking_tz": "UTC"
        }
        
        errors = self.validator.validate_schema(valid_request, contract.request_schema)
        assert len(errors) == 0, f"Valid request failed validation: {errors}"
        
        # Valid response
        valid_response = {
            "id": str(uuid.uuid4()),
            "tenant_id": str(uuid.uuid4()),
            "customer_id": str(uuid.uuid4()),
            "service_id": str(uuid.uuid4()),
            "start_at": "2025-01-28T10:00:00Z",
            "end_at": "2025-01-28T11:00:00Z",
            "status": "pending",
            "created_at": "2025-01-27T10:00:00Z"
        }
        
        errors = self.validator.validate_schema(valid_response, contract.response_schema)
        assert len(errors) == 0, f"Valid response failed validation: {errors}"
    
    def test_availability_query_contract(self):
        """Test availability query contract."""
        contract = next(c for c in self.validator.contracts if c.endpoint == "/api/availability")
        
        # Valid request
        valid_request = {
            "service_id": str(uuid.uuid4()),
            "date_from": "2025-01-28T00:00:00Z",
            "date_to": "2025-01-29T00:00:00Z",
            "tz": "UTC"
        }
        
        errors = self.validator.validate_schema(valid_request, contract.request_schema)
        assert len(errors) == 0, f"Valid request failed validation: {errors}"
        
        # Valid response
        valid_response = {
            "slots": [
                {
                    "start_at": "2025-01-28T10:00:00Z",
                    "end_at": "2025-01-28T11:00:00Z",
                    "resource_id": str(uuid.uuid4()),
                    "available": True
                }
            ]
        }
        
        errors = self.validator.validate_schema(valid_response, contract.response_schema)
        assert len(errors) == 0, f"Valid response failed validation: {errors}"
    
    def test_all_contracts_defined(self):
        """Test that all required contracts are defined."""
        required_endpoints = [
            "/health/live",
            "/v1/b/{slug}",
            "/api/tenants/{tenant_id}/bookings",
            "/api/availability"
        ]
        
        defined_endpoints = [c.endpoint for c in self.validator.contracts]
        
        for endpoint in required_endpoints:
            assert endpoint in defined_endpoints, f"Contract for {endpoint} not defined"


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
