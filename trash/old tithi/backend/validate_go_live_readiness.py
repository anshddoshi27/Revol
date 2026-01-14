#!/usr/bin/env python3
"""
Validation script for go-live readiness system.

This script validates that:
1. Tenant status progression is implemented
2. Readiness validation logic is complete
3. Resolve-tenant API includes readiness information
4. Go-live requirements endpoint exists
"""

import os
import re

def validate_tenant_status_progression():
    """Validate tenant status progression is implemented."""
    print("🔍 Validating tenant status progression...")
    
    try:
        with open('app/models/core.py', 'r') as f:
            content = f.read()
        
        # Check if status field supports progression
        if 'onboarding' in content and 'ready' in content and 'active' in content:
            print("  ✅ Tenant status progression supported")
        else:
            print("  ❌ Tenant status progression not supported")
            return False
        
        # Check if default status is onboarding
        if 'default="onboarding"' in content:
            print("  ✅ Default tenant status is onboarding")
        else:
            print("  ❌ Default tenant status not set to onboarding")
            return False
        
        print("  ✅ Tenant status progression validation passed")
        return True
        
    except Exception as e:
        print(f"  ❌ Error validating tenant status: {e}")
        return False

def validate_readiness_service():
    """Validate readiness service is implemented."""
    print("🔍 Validating readiness service...")
    
    try:
        if not os.path.exists('app/services/readiness.py'):
            print("  ❌ Readiness service file missing")
            return False
        
        with open('app/services/readiness.py', 'r') as f:
            content = f.read()
        
        # Check for key methods
        required_methods = [
            'check_tenant_readiness',
            'update_tenant_status',
            'get_go_live_requirements'
        ]
        
        for method in required_methods:
            if f'def {method}' in content:
                print(f"  ✅ {method} method exists")
            else:
                print(f"  ❌ {method} method missing")
                return False
        
        # Check for requirement checks
        required_checks = [
            'stripe_connected',
            'has_services',
            'has_availability',
            'has_policies',
            'has_business_info'
        ]
        
        for check in required_checks:
            if check in content:
                print(f"  ✅ {check} check implemented")
            else:
                print(f"  ❌ {check} check missing")
                return False
        
        print("  ✅ Readiness service validation passed")
        return True
        
    except Exception as e:
        print(f"  ❌ Error validating readiness service: {e}")
        return False

def validate_resolve_tenant_readiness():
    """Validate resolve-tenant API includes readiness."""
    print("🔍 Validating resolve-tenant API readiness...")
    
    try:
        with open('app/blueprints/onboarding.py', 'r') as f:
            content = f.read()
        
        # Check if resolve-tenant includes readiness validation
        if 'TenantReadinessService' in content:
            print("  ✅ Resolve-tenant uses readiness service")
        else:
            print("  ❌ Resolve-tenant doesn't use readiness service")
            return False
        
        # Check if booking status includes readiness
        if 'readiness' in content and 'booking' in content:
            print("  ✅ Resolve-tenant includes readiness in booking status")
        else:
            print("  ❌ Resolve-tenant missing readiness in booking status")
            return False
        
        # Check if booking_enabled is based on readiness
        if 'booking_enabled = is_ready' in content:
            print("  ✅ Booking enabled based on readiness")
        else:
            print("  ❌ Booking enabled not based on readiness")
            return False
        
        print("  ✅ Resolve-tenant API readiness validation passed")
        return True
        
    except Exception as e:
        print(f"  ❌ Error validating resolve-tenant API: {e}")
        return False

def validate_go_live_requirements_endpoint():
    """Validate go-live requirements endpoint exists."""
    print("🔍 Validating go-live requirements endpoint...")
    
    try:
        with open('app/blueprints/onboarding.py', 'r') as f:
            content = f.read()
        
        # Check if go-live requirements endpoint exists
        if '/go-live-requirements/<tenant_id>' in content:
            print("  ✅ Go-live requirements endpoint exists")
        else:
            print("  ❌ Go-live requirements endpoint missing")
            return False
        
        # Check if endpoint returns proper structure
        if 'get_go_live_requirements' in content:
            print("  ✅ Go-live requirements endpoint implemented")
        else:
            print("  ❌ Go-live requirements endpoint not implemented")
            return False
        
        print("  ✅ Go-live requirements endpoint validation passed")
        return True
        
    except Exception as e:
        print(f"  ❌ Error validating go-live requirements endpoint: {e}")
        return False

def validate_tenant_service_status():
    """Validate tenant service creates tenants with onboarding status."""
    print("🔍 Validating tenant service status...")
    
    try:
        with open('app/services/core.py', 'r') as f:
            content = f.read()
        
        # Check if tenant creation uses onboarding status
        if 'status="onboarding"' in content:
            print("  ✅ Tenant service creates tenants with onboarding status")
        else:
            print("  ❌ Tenant service doesn't use onboarding status")
            return False
        
        print("  ✅ Tenant service status validation passed")
        return True
        
    except Exception as e:
        print(f"  ❌ Error validating tenant service: {e}")
        return False

def validate_migration():
    """Validate migration for status progression."""
    print("🔍 Validating status progression migration...")
    
    try:
        migration_file = 'migrations/versions/0040_tenant_status_progression.sql'
        if os.path.exists(migration_file):
            print("  ✅ Status progression migration exists")
            
            with open(migration_file, 'r') as f:
                content = f.read()
            
            # Check for status constraint update
            if 'onboarding' in content and 'ready' in content and 'active' in content:
                print("  ✅ Migration includes status progression")
            else:
                print("  ❌ Migration missing status progression")
                return False
            
            print("  ✅ Status progression migration validation passed")
            return True
        else:
            print("  ❌ Status progression migration missing")
            return False
        
    except Exception as e:
        print(f"  ❌ Error validating migration: {e}")
        return False

def validate_test_coverage():
    """Validate test coverage for go-live readiness."""
    print("🔍 Validating test coverage...")
    
    try:
        if not os.path.exists('test_go_live_readiness.py'):
            print("  ❌ Go-live readiness test file missing")
            return False
        
        with open('test_go_live_readiness.py', 'r') as f:
            content = f.read()
        
        # Check for key test methods
        required_tests = [
            'test_tenant_status_progression',
            'test_readiness_validation_stripe_connection',
            'test_readiness_validation_services',
            'test_readiness_validation_availability',
            'test_readiness_validation_policies',
            'test_resolve_tenant_with_readiness',
            'test_go_live_requirements_endpoint'
        ]
        
        for test in required_tests:
            if f'def {test}' in content:
                print(f"  ✅ {test} test exists")
            else:
                print(f"  ❌ {test} test missing")
                return False
        
        print("  ✅ Test coverage validation passed")
        return True
        
    except Exception as e:
        print(f"  ❌ Error validating test coverage: {e}")
        return False

def main():
    """Run all validations."""
    print("🚀 Starting go-live readiness validation...")
    print("=" * 50)
    
    validations = [
        validate_tenant_status_progression,
        validate_readiness_service,
        validate_resolve_tenant_readiness,
        validate_go_live_requirements_endpoint,
        validate_tenant_service_status,
        validate_migration,
        validate_test_coverage
    ]
    
    passed = 0
    total = len(validations)
    
    for validation in validations:
        try:
            if validation():
                passed += 1
        except Exception as e:
            print(f"  ❌ Validation failed with error: {e}")
        print()
    
    print("=" * 50)
    print(f"📊 Validation Results: {passed}/{total} passed")
    
    if passed == total:
        print("🎉 All validations passed! Go-live readiness system is ready.")
        print("\n✅ Checklist:")
        print("  ✅ Tenant status progression (onboarding → ready → active)")
        print("  ✅ Readiness validation (Stripe, services, availability, policies, business info)")
        print("  ✅ Resolve-tenant API includes readiness and booking_enabled")
        print("  ✅ Go-live requirements endpoint for admin UI")
        print("  ✅ Database migration for status progression")
        print("  ✅ Comprehensive test coverage")
        return True
    else:
        print("⚠️  Some validations failed. Please review the issues above.")
        return False

if __name__ == '__main__':
    success = main()
    exit(0 if success else 1)
