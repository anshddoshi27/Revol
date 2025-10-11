#!/usr/bin/env python3
"""
Phase 6 Production Readiness Assessment - Simple Version
"""

import os
import sys
import time
import requests
import json
from datetime import datetime
from pathlib import Path


def test_performance():
    """Test performance requirements."""
    print("📊 Testing Performance...")
    
    try:
        start_time = time.time()
        response = requests.get("http://localhost:5000/health/live", timeout=5)
        response_time = time.time() - start_time
        
        if response.status_code == 200 and response_time < 0.5:
            print(f"✅ API Response Time: {response_time:.3f}s (< 500ms)")
            return True
        else:
            print(f"❌ API Response Time: {response_time:.3f}s (>= 500ms)")
            return False
    except Exception as e:
        print(f"❌ Performance test failed: {e}")
        return False


def test_observability():
    """Test observability requirements."""
    print("📈 Testing Observability...")
    
    tests_passed = 0
    total_tests = 3
    
    # Test health endpoint
    try:
        response = requests.get("http://localhost:5000/health/live", timeout=5)
        if response.status_code == 200:
            print("✅ Health endpoint available")
            tests_passed += 1
        else:
            print(f"❌ Health endpoint failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Health endpoint test failed: {e}")
    
    # Test metrics endpoint
    try:
        response = requests.get("http://localhost:5000/metrics", timeout=5)
        if response.status_code == 200:
            print("✅ Prometheus metrics available")
            tests_passed += 1
        else:
            print(f"❌ Metrics endpoint failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Metrics endpoint test failed: {e}")
    
    # Test middleware files
    middleware_files = [
        'backend/app/middleware/sentry_middleware.py',
        'backend/app/middleware/metrics_middleware.py',
        'backend/app/middleware/enhanced_logging_middleware.py'
    ]
    
    all_middleware_exists = all(Path(f).exists() for f in middleware_files)
    if all_middleware_exists:
        print("✅ Observability middleware implemented")
        tests_passed += 1
    else:
        print("❌ Observability middleware missing")
    
    return tests_passed / total_tests


def test_cicd():
    """Test CI/CD requirements."""
    print("🔄 Testing CI/CD...")
    
    tests_passed = 0
    total_tests = 4
    
    # Test GitHub Actions
    if Path('.github/workflows/ci.yml').exists():
        print("✅ GitHub Actions workflow exists")
        tests_passed += 1
    else:
        print("❌ GitHub Actions workflow missing")
    
    # Test pre-commit hooks
    if Path('.pre-commit-config.yaml').exists():
        print("✅ Pre-commit hooks configured")
        tests_passed += 1
    else:
        print("❌ Pre-commit hooks missing")
    
    # Test Docker configuration
    if Path('backend/Dockerfile').exists() and Path('docker-compose.yml').exists():
        print("✅ Docker configuration exists")
        tests_passed += 1
    else:
        print("❌ Docker configuration missing")
    
    # Test backup scripts
    if Path('scripts/backup_database.py').exists():
        print("✅ Backup scripts implemented")
        tests_passed += 1
    else:
        print("❌ Backup scripts missing")
    
    return tests_passed / total_tests


def test_testing_framework():
    """Test testing framework."""
    print("🧪 Testing Framework...")
    
    tests_passed = 0
    total_tests = 3
    
    # Test load testing
    if Path('tests/load/test_performance.py').exists():
        print("✅ Load testing framework exists")
        tests_passed += 1
    else:
        print("❌ Load testing framework missing")
    
    # Test contract testing
    if Path('tests/contract/test_api_contracts.py').exists():
        print("✅ Contract testing framework exists")
        tests_passed += 1
    else:
        print("❌ Contract testing framework missing")
    
    # Test requirements.txt
    if Path('backend/requirements.txt').exists():
        with open('backend/requirements.txt', 'r') as f:
            content = f.read()
            if 'prometheus-client' in content and 'sentry-sdk' in content:
                print("✅ Observability dependencies included")
                tests_passed += 1
            else:
                print("❌ Observability dependencies missing")
    else:
        print("❌ Requirements.txt missing")
    
    return tests_passed / total_tests


def main():
    """Main assessment function."""
    print("🚀 Phase 6 Production Readiness Assessment")
    print("=" * 50)
    
    results = {
        'timestamp': datetime.now().isoformat(),
        'categories': {}
    }
    
    # Run assessments
    results['categories']['performance'] = {
        'name': 'Performance',
        'score': 100 if test_performance() else 0
    }
    
    results['categories']['observability'] = {
        'name': 'Observability',
        'score': round(test_observability() * 100, 1)
    }
    
    results['categories']['cicd'] = {
        'name': 'CI/CD',
        'score': round(test_cicd() * 100, 1)
    }
    
    results['categories']['testing'] = {
        'name': 'Testing Framework',
        'score': round(test_testing_framework() * 100, 1)
    }
    
    # Calculate overall score
    total_score = sum(cat['score'] for cat in results['categories'].values())
    overall_score = total_score / len(results['categories'])
    results['overall_score'] = round(overall_score, 1)
    
    # Print results
    print("\n" + "=" * 50)
    print("📊 ASSESSMENT RESULTS")
    print("=" * 50)
    
    for category_name, category_data in results['categories'].items():
        score = category_data['score']
        status = "✅" if score >= 75 else "⚠️" if score >= 50 else "❌"
        print(f"{status} {category_data['name']}: {score}%")
    
    print(f"\n🎯 Overall Score: {results['overall_score']}%")
    
    if results['overall_score'] >= 90:
        print("🎉 EXCELLENT! System is production ready!")
    elif results['overall_score'] >= 75:
        print("👍 GOOD! Minor improvements needed.")
    elif results['overall_score'] >= 50:
        print("⚠️ FAIR! Significant work needed.")
    else:
        print("🚨 POOR! Major work required.")
    
    # Save results
    with open('phase6_assessment_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\n📄 Results saved to: phase6_assessment_results.json")
    
    return results['overall_score'] >= 75


if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)
