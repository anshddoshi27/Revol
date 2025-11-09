#!/usr/bin/env python3
"""
Test script to validate the new endpoint mappings for frontend integration.

This script tests the key endpoints that were added to fix the frontend-backend
integration issues in the onboarding flow.
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:5000"  # Adjust if your backend runs on different port
TEST_TENANT_ID = "550e8400-e29b-41d4-a716-446655440000"
TEST_USER_ID = "user-123"

# Mock headers for testing (in real scenario, these would come from JWT)
HEADERS = {
    "Content-Type": "application/json",
    "Authorization": "Bearer mock-jwt-token",
    "X-Tenant-ID": TEST_TENANT_ID,
    "X-User-ID": TEST_USER_ID
}

def test_endpoint(method, url, data=None, expected_status=200):
    """Test a single endpoint and return the result."""
    try:
        if method.upper() == "GET":
            response = requests.get(f"{BASE_URL}{url}", headers=HEADERS)
        elif method.upper() == "POST":
            response = requests.post(f"{BASE_URL}{url}", headers=HEADERS, json=data)
        elif method.upper() == "PUT":
            response = requests.put(f"{BASE_URL}{url}", headers=HEADERS, json=data)
        elif method.upper() == "DELETE":
            response = requests.delete(f"{BASE_URL}{url}", headers=HEADERS)
        else:
            return False, f"Unsupported method: {method}"
        
        success = response.status_code == expected_status
        return success, f"Status: {response.status_code}, Response: {response.text[:200]}"
    
    except requests.exceptions.ConnectionError:
        return False, "Connection failed - is the backend server running?"
    except Exception as e:
        return False, f"Error: {str(e)}"

def main():
    """Run all endpoint tests."""
    print("🧪 Testing Frontend-Backend Endpoint Mappings")
    print("=" * 50)
    
    tests = [
        # Categories endpoints (Frontend Step 3)
        ("GET", "/api/v1/categories", None, 200),
        ("POST", "/api/v1/categories", {"name": "Test Category", "description": "Test description"}, 201),
        ("GET", "/api/v1/categories/cat_test_category", None, 200),
        ("PUT", "/api/v1/categories/cat_test_category", {"name": "Updated Category"}, 200),
        ("DELETE", "/api/v1/categories/cat_test_category", None, 200),
        
        # Availability rules endpoints (Frontend Step 4)
        ("GET", "/api/v1/availability/rules", None, 200),
        ("POST", "/api/v1/availability/rules", {
            "staff_id": "550e8400-e29b-41d4-a716-446655440001",
            "day_of_week": 1,
            "start_time": "09:00",
            "end_time": "17:00"
        }, 201),
        ("POST", "/api/v1/availability/rules/bulk", {
            "rules": [{
                "staff_id": "550e8400-e29b-41d4-a716-446655440001",
                "day_of_week": 2,
                "start_time": "09:00",
                "end_time": "17:00"
            }]
        }, 201),
        ("POST", "/api/v1/availability/rules/validate", {
            "rules": [{
                "staff_id": "550e8400-e29b-41d4-a716-446655440001",
                "day_of_week": 1,
                "start_time": "09:00",
                "end_time": "17:00"
            }]
        }, 200),
        ("GET", "/api/v1/availability/summary?start_date=2024-01-01T00:00:00Z&end_date=2024-01-31T23:59:59Z", None, 200),
        
        # Admin payment endpoints (Frontend Step 8)
        ("POST", "/api/v1/admin/payments/setup-intent", {"metadata": {"test": True}}, 201),
        ("POST", "/api/v1/admin/payments/setup-intent/test-intent/confirm", {"payment_method": "pm_test"}, 200),
        ("PUT", f"/api/v1/admin/payments/wallets/{TEST_TENANT_ID}", {"supported_methods": ["card"]}, 200),
        ("GET", f"/api/v1/admin/payments/kyc/{TEST_TENANT_ID}", None, 200),
        ("POST", f"/api/v1/admin/payments/kyc/{TEST_TENANT_ID}", {"business_name": "Test Business"}, 201),
        ("GET", f"/api/v1/admin/payments/go-live/{TEST_TENANT_ID}", None, 200),
        ("POST", f"/api/v1/admin/payments/go-live/{TEST_TENANT_ID}", {"business_name": "Test Business"}, 200),
        
        # Notification endpoints (Frontend Step 5)
        ("GET", "/notifications/templates", None, 200),
        ("POST", "/notifications/templates", {
            "name": "Test Template",
            "channel": "email",
            "content": "Test content",
            "subject": "Test Subject"
        }, 201),
    ]
    
    passed = 0
    failed = 0
    
    for i, (method, url, data, expected_status) in enumerate(tests, 1):
        print(f"\n{i:2d}. {method} {url}")
        success, message = test_endpoint(method, url, data, expected_status)
        
        if success:
            print(f"    ✅ PASS - {message}")
            passed += 1
        else:
            print(f"    ❌ FAIL - {message}")
            failed += 1
    
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {passed} passed, {failed} failed")
    
    if failed == 0:
        print("🎉 All tests passed! Frontend-backend integration should work.")
        return 0
    else:
        print("⚠️  Some tests failed. Check the backend server and endpoint implementations.")
        return 1

if __name__ == "__main__":
    sys.exit(main())

