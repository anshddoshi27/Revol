#!/bin/bash

# Tithi Backend Testing Script
# This script helps test the backend endpoints after setup
#
# Usage:
#   ./scripts/test-backend.sh
#   ACCESS_TOKEN='token' ./scripts/test-backend.sh
#   SERVICE_ID='uuid' DATE='2025-01-20' ./scripts/test-backend.sh
#
# Environment Variables:
#   BASE_URL - Backend base URL (default: http://localhost:3000)
#   ACCESS_TOKEN - Supabase auth token for authenticated endpoints
#   BUSINESS_SUBDOMAIN - Business subdomain for public endpoints (default: test-business)
#   SERVICE_ID - Service UUID for availability testing
#   DATE - Date for availability testing (default: today in UTC)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

BASE_URL="${BASE_URL:-http://localhost:3000}"
ACCESS_TOKEN="${ACCESS_TOKEN:-}"
BUSINESS_SUBDOMAIN="${BUSINESS_SUBDOMAIN:-test-business}"
SERVICE_ID="${SERVICE_ID:-}"
DATE="${DATE:-}"

# Counters
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_WARNED=0

echo -e "${GREEN}🚀 Tithi Backend Testing Script${NC}\n"
echo -e "${BLUE}Base URL:${NC} $BASE_URL"
echo -e "${BLUE}Business Subdomain:${NC} $BUSINESS_SUBDOMAIN"
[ -n "$ACCESS_TOKEN" ] && echo -e "${BLUE}Access Token:${NC} ${ACCESS_TOKEN:0:20}..."
[ -n "$SERVICE_ID" ] && echo -e "${BLUE}Service ID:${NC} $SERVICE_ID"
[ -n "$DATE" ] && echo -e "${BLUE}Date:${NC} $DATE"
echo ""

# Helper function to print test result
test_result() {
    local status=$1
    local message=$2
    if [ "$status" = "pass" ]; then
        echo -e "${GREEN}✅ $message${NC}"
        ((TESTS_PASSED++))
    elif [ "$status" = "fail" ]; then
        echo -e "${RED}❌ $message${NC}"
        ((TESTS_FAILED++))
    elif [ "$status" = "warn" ]; then
        echo -e "${YELLOW}⚠️  $message${NC}"
        ((TESTS_WARNED++))
    fi
}

# Check if server is running
echo -e "${YELLOW}1. Checking if server is running...${NC}"
if curl -s -f "$BASE_URL/api/test-db" > /dev/null 2>&1; then
    test_result "pass" "Server is running at $BASE_URL"
else
    test_result "fail" "Server is not running at $BASE_URL"
    echo "   Start the server with: cd apps/web && npm run dev"
    exit 1
fi
echo ""

# Test database connection
echo -e "${YELLOW}2. Testing database connection...${NC}"
DB_TEST=$(curl -s "$BASE_URL/api/test-db" 2>/dev/null || echo "")
if echo "$DB_TEST" | grep -q '"success":true'; then
    if echo "$DB_TEST" | grep -q '"connected":true' && echo "$DB_TEST" | grep -q '"tablesExist":true'; then
        test_result "pass" "Database connection OK (connected: true, tablesExist: true)"
    else
        test_result "warn" "Database connection response unexpected: $DB_TEST"
    fi
else
    test_result "fail" "Database connection failed"
    echo "   Response: $DB_TEST"
    echo "   Check: SUPABASE_SERVICE_ROLE_KEY in .env.local"
    exit 1
fi
echo ""

# Test public catalog endpoint
echo -e "${YELLOW}3. Testing public catalog endpoint...${NC}"
CATALOG=$(curl -s "$BASE_URL/api/public/$BUSINESS_SUBDOMAIN/catalog" 2>/dev/null || echo "")
CATALOG_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/public/$BUSINESS_SUBDOMAIN/catalog" 2>/dev/null || echo "000")

if [ "$CATALOG_STATUS" = "200" ]; then
    if echo "$CATALOG" | grep -q '"business"'; then
        test_result "pass" "Catalog endpoint OK (returns business data)"
    else
        test_result "warn" "Catalog endpoint returned 200 but unexpected response format"
        echo "   Response: ${CATALOG:0:200}..."
    fi
elif [ "$CATALOG_STATUS" = "404" ]; then
    test_result "warn" "Catalog endpoint returned 404 (business '$BUSINESS_SUBDOMAIN' may not exist)"
    echo "   Tip: Complete onboarding Step 2 to create a business with subdomain"
else
    test_result "warn" "Catalog endpoint returned status $CATALOG_STATUS"
fi
echo ""

# Test public availability endpoint (if service_id provided)
if [ -n "$SERVICE_ID" ]; then
    echo -e "${YELLOW}4. Testing public availability endpoint...${NC}"
    AVAIL_DATE="${DATE:-$(date -u +%Y-%m-%d)}"
    AVAIL_URL="$BASE_URL/api/public/$BUSINESS_SUBDOMAIN/availability?service_id=$SERVICE_ID&date=$AVAIL_DATE"
    AVAIL=$(curl -s "$AVAIL_URL" 2>/dev/null || echo "")
    AVAIL_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$AVAIL_URL" 2>/dev/null || echo "000")
    
    if [ "$AVAIL_STATUS" = "200" ]; then
        if echo "$AVAIL" | grep -q '"slots"'; then
            test_result "pass" "Availability endpoint OK (returns slots array)"
        else
            test_result "warn" "Availability endpoint returned 200 but unexpected response format"
            echo "   Response: ${AVAIL:0:200}..."
        fi
    elif [ "$AVAIL_STATUS" = "400" ]; then
        test_result "warn" "Availability endpoint returned 400 (check service_id and date format)"
        echo "   URL: $AVAIL_URL"
    else
        test_result "warn" "Availability endpoint returned status $AVAIL_STATUS"
    fi
    echo ""
else
    echo -e "${YELLOW}4. Skipping availability endpoint test (SERVICE_ID not provided)${NC}"
    echo "   Tip: export SERVICE_ID='service_uuid' to test availability"
    echo ""
fi

# Test admin endpoints (if access token provided)
if [ -n "$ACCESS_TOKEN" ]; then
    echo -e "${YELLOW}5. Testing admin endpoints...${NC}"
    
    # Test list bookings
    echo -e "   ${BLUE}5.1 List bookings endpoint...${NC}"
    BOOKINGS=$(curl -s -H "Authorization: Bearer $ACCESS_TOKEN" "$BASE_URL/api/admin/bookings" 2>/dev/null || echo "")
    BOOKINGS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $ACCESS_TOKEN" "$BASE_URL/api/admin/bookings" 2>/dev/null || echo "000")
    
    if [ "$BOOKINGS_STATUS" = "200" ]; then
        if echo "$BOOKINGS" | grep -q '"items"'; then
            test_result "pass" "List bookings endpoint OK (returns items array)"
        else
            test_result "warn" "List bookings endpoint returned 200 but unexpected response format"
            echo "      Response: ${BOOKINGS:0:200}..."
        fi
    elif [ "$BOOKINGS_STATUS" = "401" ]; then
        test_result "fail" "List bookings endpoint returned 401 (invalid or expired token)"
        echo "      Tip: Get a new access token from Supabase Auth"
    else
        test_result "warn" "List bookings endpoint returned status $BOOKINGS_STATUS"
    fi
    
    # Test onboarding step 1 (if business doesn't exist)
    echo -e "   ${BLUE}5.2 Onboarding Step 1 endpoint...${NC}"
    STEP1_RESPONSE=$(curl -s -X PUT \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -d '{"businessName":"Test Business","industry":"Beauty"}' \
        "$BASE_URL/api/business/onboarding/step-1-business" 2>/dev/null || echo "")
    STEP1_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X PUT \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -d '{"businessName":"Test Business","industry":"Beauty"}' \
        "$BASE_URL/api/business/onboarding/step-1-business" 2>/dev/null || echo "000")
    
    if [ "$STEP1_STATUS" = "200" ]; then
        if echo "$STEP1_RESPONSE" | grep -q '"success":true'; then
            test_result "pass" "Onboarding Step 1 endpoint OK"
        else
            test_result "warn" "Onboarding Step 1 returned 200 but unexpected response"
        fi
    elif [ "$STEP1_STATUS" = "401" ]; then
        test_result "fail" "Onboarding Step 1 returned 401 (invalid token)"
    else
        test_result "warn" "Onboarding Step 1 returned status $STEP1_STATUS"
    fi
    
    echo ""
else
    echo -e "${YELLOW}5. Skipping authenticated endpoints (ACCESS_TOKEN not provided)${NC}"
    echo "   Tip: export ACCESS_TOKEN='your_access_token' to test admin endpoints"
    echo ""
fi

# Print summary
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Test Summary:${NC}"
echo -e "  ${GREEN}✅ Passed:${NC} $TESTS_PASSED"
if [ $TESTS_WARNED -gt 0 ]; then
    echo -e "  ${YELLOW}⚠️  Warnings:${NC} $TESTS_WARNED"
fi
if [ $TESTS_FAILED -gt 0 ]; then
    echo -e "  ${RED}❌ Failed:${NC} $TESTS_FAILED"
fi
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Exit with error if any tests failed
if [ $TESTS_FAILED -gt 0 ]; then
    echo -e "${RED}❌ Some tests failed. Please check the errors above.${NC}"
    exit 1
elif [ $TESTS_PASSED -gt 0 ]; then
    echo -e "${GREEN}✅ All critical tests passed!${NC}"
    if [ $TESTS_WARNED -gt 0 ]; then
        echo -e "${YELLOW}⚠️  Some warnings (business may not exist yet - complete onboarding)${NC}"
    fi
    exit 0
else
    echo -e "${YELLOW}⚠️  No tests were run.${NC}"
    exit 0
fi

# Usage examples at the end
echo ""
echo -e "${BLUE}Usage Examples:${NC}"
echo "  # Basic test (no auth):"
echo "  ./scripts/test-backend.sh"
echo ""
echo "  # With authentication:"
echo "  export ACCESS_TOKEN='your_access_token'"
echo "  ./scripts/test-backend.sh"
echo ""
echo "  # With availability testing:"
echo "  export SERVICE_ID='service_uuid' DATE='2025-01-20'"
echo "  ./scripts/test-backend.sh"
echo ""
echo "  # Custom base URL:"
echo "  BASE_URL='https://production.com' ./scripts/test-backend.sh"
echo ""


