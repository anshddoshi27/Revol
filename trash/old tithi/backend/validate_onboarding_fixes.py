#!/usr/bin/env python3
"""
Validation script for onboarding persistence fixes.

This script validates that:
1. All new fields are properly defined in the Tenant model
2. The onboarding registration handles all fields
3. The resolve-tenant API is properly implemented
4. Policy overwrite issue is fixed
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def validate_tenant_model():
    """Validate Tenant model has all required fields."""
    print("🔍 Validating Tenant model...")
    
    try:
        from app.models.core import Tenant
        
        # Check if new fields exist
        required_fields = [
            'address_json', 'social_links_json', 'branding_json', 'policies_json'
        ]
        
        for field in required_fields:
            if hasattr(Tenant, field):
                print(f"  ✅ {field} field exists")
            else:
                print(f"  ❌ {field} field missing")
                return False
        
        print("  ✅ All required fields exist in Tenant model")
        return True
        
    except Exception as e:
        print(f"  ❌ Error validating Tenant model: {e}")
        return False

def validate_onboarding_blueprint():
    """Validate onboarding blueprint has resolve-tenant endpoint."""
    print("🔍 Validating onboarding blueprint...")
    
    try:
        from app.blueprints.onboarding import onboarding_bp
        
        # Check if resolve-tenant route exists
        routes = [rule.rule for rule in onboarding_bp.url_map.iter_rules()]
        
        if '/resolve-tenant' in routes:
            print("  ✅ resolve-tenant endpoint exists")
        else:
            print("  ❌ resolve-tenant endpoint missing")
            return False
        
        print("  ✅ Onboarding blueprint validation passed")
        return True
        
    except Exception as e:
        print(f"  ❌ Error validating onboarding blueprint: {e}")
        return False

def validate_tenant_service():
    """Validate TenantService handles new fields."""
    print("🔍 Validating TenantService...")
    
    try:
        from app.services.core import TenantService
        
        # Check if create_tenant method handles new fields
        import inspect
        source = inspect.getsource(TenantService.create_tenant)
        
        required_fields = [
            'address_json', 'social_links_json', 'branding_json', 'policies_json'
        ]
        
        for field in required_fields:
            if field in source:
                print(f"  ✅ {field} handled in TenantService")
            else:
                print(f"  ❌ {field} not handled in TenantService")
                return False
        
        print("  ✅ TenantService validation passed")
        return True
        
    except Exception as e:
        print(f"  ❌ Error validating TenantService: {e}")
        return False

def validate_policy_fix():
    """Validate policy overwrite fix."""
    print("🔍 Validating policy overwrite fix...")
    
    try:
        from app.blueprints.onboarding import create_default_policies
        import inspect
        source = inspect.getsource(create_default_policies)
        
        # Check if the function now respects user policies
        if 'user_policies' in source and 'merged_policies' in source:
            print("  ✅ Policy overwrite fix implemented")
            return True
        else:
            print("  ❌ Policy overwrite fix not implemented")
            return False
        
    except Exception as e:
        print(f"  ❌ Error validating policy fix: {e}")
        return False

def main():
    """Run all validations."""
    print("🚀 Starting onboarding persistence validation...")
    print("=" * 50)
    
    validations = [
        validate_tenant_model,
        validate_onboarding_blueprint,
        validate_tenant_service,
        validate_policy_fix
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
        print("🎉 All validations passed! Onboarding persistence fixes are ready.")
        return True
    else:
        print("⚠️  Some validations failed. Please review the issues above.")
        return False

if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)
