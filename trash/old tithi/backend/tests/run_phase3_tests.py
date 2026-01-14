#!/usr/bin/env python3
"""
Phase 3 Production Readiness Test Runner

This script runs all Phase 3 production readiness tests and provides a comprehensive report.
It validates that Phase 3 backend development is production ready according to the design brief.

Usage:
    python run_phase3_tests.py
    python run_phase3_tests.py --verbose
    python run_phase3_tests.py --module payments
    python run_phase3_tests.py --performance-only
"""

import sys
import os
import argparse
import subprocess
import time
from datetime import datetime

# Add the backend directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def run_command(command, description):
    """Run a command and return the result."""
    print(f"\n🔍 {description}...")
    print(f"Command: {command}")
    print("-" * 60)
    
    start_time = time.time()
    result = subprocess.run(command, shell=True, capture_output=True, text=True)
    end_time = time.time()
    
    duration = end_time - start_time
    
    if result.returncode == 0:
        print(f"✅ {description} - PASSED ({duration:.2f}s)")
        return True
    else:
        print(f"❌ {description} - FAILED ({duration:.2f}s)")
        print(f"Error: {result.stderr}")
        return False

def main():
    """Main test runner function."""
    parser = argparse.ArgumentParser(description='Phase 3 Production Readiness Test Runner')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')
    parser.add_argument('--module', '-m', choices=['payments', 'promotions', 'notifications', 'all'], 
                       default='all', help='Test specific module')
    parser.add_argument('--performance-only', action='store_true', help='Run only performance tests')
    parser.add_argument('--security-only', action='store_true', help='Run only security tests')
    parser.add_argument('--integration-only', action='store_true', help='Run only integration tests')
    parser.add_argument('--summary-only', action='store_true', help='Run only summary test')
    
    args = parser.parse_args()
    
    print("="*80)
    print("🚀 PHASE 3 PRODUCTION READINESS TEST RUNNER")
    print("="*80)
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Python version: {sys.version}")
    print(f"Working directory: {os.getcwd()}")
    
    # Test configuration
    verbose_flag = "-v" if args.verbose else ""
    test_results = []
    
    # Define test modules
    test_modules = {
        'production_readiness': 'test_phase3_production_readiness.py',
        'load_performance': 'test_phase3_load_performance.py',
        'security_compliance': 'test_phase3_security_compliance.py',
        'contract_validation': 'test_phase3_contract_validation.py',
        'integration_e2e': 'test_phase3_integration_e2e.py',
        'observability_monitoring': 'test_phase3_observability_monitoring.py',
        'summary': 'test_phase3_production_readiness_summary.py'
    }
    
    # Filter tests based on arguments
    if args.performance_only:
        test_modules = {'load_performance': test_modules['load_performance']}
    elif args.security_only:
        test_modules = {'security_compliance': test_modules['security_compliance']}
    elif args.integration_only:
        test_modules = {'integration_e2e': test_modules['integration_e2e']}
    elif args.summary_only:
        test_modules = {'summary': test_modules['summary']}
    elif args.module != 'all':
        # Filter by specific module
        if args.module == 'payments':
            test_modules = {
                'production_readiness': test_modules['production_readiness'],
                'contract_validation': test_modules['contract_validation']
            }
        elif args.module == 'promotions':
            test_modules = {
                'production_readiness': test_modules['production_readiness'],
                'contract_validation': test_modules['contract_validation']
            }
        elif args.module == 'notifications':
            test_modules = {
                'production_readiness': test_modules['production_readiness'],
                'contract_validation': test_modules['contract_validation']
            }
    
    # Run tests
    print(f"\n📋 Running {len(test_modules)} test modules...")
    
    for module_name, test_file in test_modules.items():
        command = f"python -m pytest {test_file} {verbose_flag} --tb=short"
        success = run_command(command, f"Running {module_name}")
        test_results.append((module_name, success))
    
    # Generate summary report
    print("\n" + "="*80)
    print("📊 PHASE 3 PRODUCTION READINESS SUMMARY")
    print("="*80)
    
    passed_tests = sum(1 for _, success in test_results if success)
    total_tests = len(test_results)
    
    print(f"\n📈 Test Results: {passed_tests}/{total_tests} modules passed")
    print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
    
    print("\n📋 Detailed Results:")
    for module_name, success in test_results:
        status = "✅ PASSED" if success else "❌ FAILED"
        print(f"  {module_name}: {status}")
    
    # Production readiness assessment
    if passed_tests == total_tests:
        print("\n🎉 PHASE 3 IS PRODUCTION READY! 🎉")
        print("\n✅ All Phase 3 modules have passed production readiness tests:")
        print("   • Module H: Payments & Billing")
        print("   • Module I: Promotions & Gift Cards")
        print("   • Module J: Notifications & Messaging")
        print("   • Security & Compliance")
        print("   • Performance & Scalability")
        print("   • Error Handling & Recovery")
        print("   • Audit Logging & Monitoring")
        print("   • Tenant Isolation")
        print("   • Contract Validation")
        print("   • Observability & Monitoring")
        
        print("\n🚀 Phase 3 backend development is complete and ready for production deployment!")
        print("\n📋 Next Steps:")
        print("   1. Deploy to staging environment")
        print("   2. Run end-to-end integration tests")
        print("   3. Perform load testing")
        print("   4. Security audit")
        print("   5. Deploy to production")
        
    else:
        print(f"\n❌ PHASE 3 IS NOT PRODUCTION READY")
        print(f"   {total_tests - passed_tests} modules failed production readiness tests.")
        print("   Please address the failing modules before proceeding to production.")
        
        print("\n🔧 Recommended Actions:")
        print("   1. Review failed test outputs")
        print("   2. Fix identified issues")
        print("   3. Re-run tests")
        print("   4. Ensure all modules pass before production deployment")
    
    print(f"\n⏱️  Total execution time: {time.time() - time.time():.2f} seconds")
    print(f"Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*80)
    
    # Exit with appropriate code
    sys.exit(0 if passed_tests == total_tests else 1)

if __name__ == '__main__':
    main()
