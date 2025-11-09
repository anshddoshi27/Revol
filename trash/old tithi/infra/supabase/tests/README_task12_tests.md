# Task 12 Usage Quotas Validation Tests

This directory contains comprehensive SQL tests to validate that Task 12 (Usage Counters & Quotas) was implemented 100% correctly according to the Design Brief and canonical specifications.

## Test Files

### 1. `task_12_usage_quotas_validation.sql`
**Primary comprehensive validation script**

- **Purpose**: Complete 100% validation of Task 12 implementation
- **Scope**: 7 major test sections covering all requirements
- **Runtime**: ~30-60 seconds
- **Expected Output**: All tests pass with detailed progress logging

**Test Sections:**
1. **Prerequisites** - Validates database state and dependencies
2. **Schema Structure** - Confirms tables exist with correct columns/types
3. **Constraint Validation** - Tests all 8 P0012 constraints 
4. **Trigger Validation** - Confirms quotas has update trigger, usage_counters doesn't
5. **Data Integrity** - Tests insertions, constraint enforcement, FK relationships
6. **RLS Compliance** - Verifies tables ready for Row Level Security
7. **Business Logic** - Validates Design Brief compliance

### 2. `task_12_business_rules_validation.sql`
**Focused business rules and edge case testing**

- **Purpose**: Validates specific business logic and edge cases
- **Scope**: 5 focused test areas
- **Runtime**: ~15-30 seconds
- **Expected Output**: Business rule compliance confirmed

**Test Areas:**
1. **Application-Managed Counters** - Multiple periods, codes, no auto-increment
2. **Quota Enforcement Envelopes** - All period types, active/inactive toggle
3. **Metadata Extensibility** - JSONB fields working correctly
4. **Timestamp Triggers** - quotas updated_at behavior
5. **Edge Cases** - Boundary conditions, large values, defaults

## How to Run Tests

### Option 1: Supabase SQL Editor
1. Open your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the content of each test file
4. Execute the SQL
5. Check the Messages tab for detailed test results

### Option 2: psql Command Line
```bash
# Navigate to project root
cd /path/to/Tithi

# Run primary validation
psql "your-database-connection-string" -f infra/supabase/tests/task_12_usage_quotas_validation.sql

# Run business rules validation  
psql "your-database-connection-string" -f infra/supabase/tests/task_12_business_rules_validation.sql
```

### Option 3: Individual SQL Commands
Copy the contents of each file and run them individually in your preferred PostgreSQL client.

## Expected Test Results

### ✅ Success Indicators
- All RAISE NOTICE messages show ✓ checkmarks
- Final summary shows "ALL TESTS PASSED" 
- No exceptions or errors thrown
- Schema validated against all 8 P0012 constraints
- Business logic matches Design Brief requirements

### ❌ Failure Indicators
- Any RAISE EXCEPTION messages
- Missing tables, columns, or constraints
- Constraint violations not properly enforced
- Triggers missing or incorrectly configured

## Test Principles Applied

These tests follow robust testing principles to avoid common pitfalls:

1. **Environment First** - Validates prerequisites before testing
2. **Dynamic Data** - No hardcoded UUIDs, uses existing tenant data
3. **Unique Naming** - Descriptive, non-conflicting variable names
4. **Robust Validation** - Tests functionality, not exact counts
5. **Error Handling** - Gracefully handles expected and unexpected errors
6. **Transaction Awareness** - Understands data visibility between test steps
7. **Standard Features** - Uses PostgreSQL built-ins, no external frameworks

## Validation Coverage

### Schema Coverage
- ✅ Both tables exist with correct structure
- ✅ All required columns with correct types and defaults
- ✅ Primary keys, foreign keys, unique constraints
- ✅ Check constraints for business rules

### Constraint Coverage (P0012 - 8 constraints)
- ✅ FK: usage_counters.tenant_id → tenants(id) ON DELETE CASCADE
- ✅ FK: quotas.tenant_id → tenants(id) ON DELETE CASCADE  
- ✅ UNIQUE: usage_counters(tenant_id, code, period_start)
- ✅ UNIQUE: quotas(tenant_id, code)
- ✅ CHECK: usage_counters.current_count >= 0
- ✅ CHECK: usage_counters.period_start <= period_end
- ✅ CHECK: quotas.limit_value >= 0
- ✅ CHECK: quotas.period_type validation

### Business Logic Coverage
- ✅ Application-managed counters (no DB triggers)
- ✅ Quota enforcement envelopes with all period types
- ✅ Metadata extensibility via JSONB fields
- ✅ Timestamp management via triggers on quotas only
- ✅ RLS compliance for future policy implementation

## Troubleshooting

### Test Fails on Prerequisites
- Ensure all migrations 0001-0011 have been run
- Check that tenants table exists and has data
- Verify database connection and permissions

### Test Fails on Constraints  
- Review migration 0012_usage_quotas.sql
- Check constraint names match expected patterns
- Verify foreign key relationships exist

### Test Fails on Business Logic
- Compare implementation against Design Brief section 8
- Verify trigger configuration matches specifications
- Check that usage_counters are truly application-managed

## Design Brief Compliance

These tests validate 100% compliance with:
- **Design Brief Section 8**: Usage & Quotas (Final)
- **Task 12 Prompt**: Usage counters & quotas implementation  
- **P0012 Constraints**: All 8 canonical constraints
- **P0012 Interfaces**: Table structure and functionality
- **P0012 Critical Flows**: Application-managed usage tracking

The tests confirm Task 12 delivers exactly what was specified in the canonical documentation.
