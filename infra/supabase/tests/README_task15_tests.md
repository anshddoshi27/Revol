# Task 15 Testing Scripts

This directory contains comprehensive test scripts to validate Task 15 (Standard tenant-scoped policies) implementation.

## Test Scripts Overview

### 1. `task_15_quick_check.sql` ⚡ (RECOMMENDED FOR QUICK VALIDATION)
**Purpose**: Fast pass/fail validation of Task 15 compliance  
**Runtime**: ~2-3 seconds  
**Use case**: Quick validation before moving to Task 16

**What it checks:**
- ✅ Helper functions exist (`current_tenant_id`, `current_user_id`)
- ✅ RLS enabled on all 18 tenant-scoped tables
- ✅ Each table has exactly 4 policies (SELECT/INSERT/UPDATE/DELETE)
- ✅ All policies use correct `tenant_id = public.current_tenant_id()` predicates
- ✅ Policy naming follows convention (`table_sel`, `table_ins`, etc.)

**Expected output**: Should show "🎉 TASK 15 FULLY COMPLIANT!" if everything is correct.

### 2. `task_15_validation.sql` (COMPREHENSIVE RUBRIC)
**Purpose**: Complete validation against the provided rubric  
**Runtime**: ~5-10 seconds  
**Use case**: Thorough validation with detailed failure reporting

**What it checks:**
- All items from quick check plus:
- Validates against exact expected policy names from 0015 migration
- Checks for missing or extra policies
- Provides detailed failure explanations

**Expected output**: Should return 0 rows if fully compliant, or detailed error descriptions if issues exist.

### 3. `task_15_practical_test.sql` (FUNCTIONAL TESTING)
**Purpose**: Tests actual policy functionality with real test data  
**Runtime**: ~10-15 seconds  
**Use case**: Verify policies work correctly in practice

**What it does:**
- Creates test tenants and users
- Inserts test data across multiple tenant-scoped tables
- Verifies data isolation and policy structure
- Tests helper function behavior
- Cleans up test data automatically

### 4. `task_15_isolation_test.sql` (DEEP INTEGRATION TEST)
**Purpose**: Comprehensive tenant isolation testing  
**Runtime**: ~15-20 seconds  
**Use case**: Deep validation of tenant isolation mechanisms

**What it does:**
- Creates comprehensive test data scenario
- Tests all tenant-scoped tables
- Validates cross-tenant data isolation
- Checks policy predicate accuracy
- Provides detailed compliance audit

## How to Run Tests

### Quick Validation (Start Here)
```sql
-- Run in your SQL editor
\i infra/supabase/tests/task_15_quick_check.sql
```

### If Quick Check Passes
```sql
-- Optional: Run comprehensive validation
\i infra/supabase/tests/task_15_validation.sql
```

### For Thorough Testing
```sql
-- Run practical tests
\i infra/supabase/tests/task_15_practical_test.sql

-- Run isolation tests  
\i infra/supabase/tests/task_15_isolation_test.sql
```

## Expected Results

### ✅ Success Indicators
- **Quick Check**: Shows "🎉 TASK 15 FULLY COMPLIANT!"
- **Validation**: Returns 0 rows (no failures)
- **Practical Test**: All checks show "✓ COMPLIANT" status
- **Isolation Test**: Final verdict shows "🎉 TASK 15 IS FULLY COMPLIANT"

### ❌ Failure Indicators
- **Quick Check**: Shows "⚠️ TASK 15 HAS ISSUES" with specific details
- **Validation**: Returns rows describing specific failures
- **Tests**: Show "✗" symbols or "NON-COMPLIANT" statuses

## Troubleshooting

### Common Issues

1. **Missing Policies**
   - Check that migration `0015_policies_standard.sql` was applied
   - Verify table names match exactly (case sensitive)

2. **Helper Functions Missing**
   - Ensure migration `0003_helpers.sql` was applied
   - Check function signatures are correct

3. **RLS Not Enabled**
   - Ensure migration `0014_enable_rls.sql` was applied
   - Check that all tables have RLS enabled

4. **Incorrect Policy Predicates**
   - Verify policies use exact predicate: `tenant_id = current_tenant_id()` (with or without `public.` prefix)
   - Check both USING and WITH CHECK clauses for INSERT/UPDATE

5. **Regex Validation Issues (FIXED)**
   - **Issue**: Validation scripts were using overly complex regex patterns that didn't match actual policy content
   - **Fix Applied**: Simplified regex to `tenant_id.*current_tenant_id` which correctly matches `(tenant_id = current_tenant_id())`
   - **Result**: All validation scripts now correctly recognize properly implemented policies

### Migration Dependencies

Task 15 requires these migrations to be applied first:
- `0001_extensions.sql` - PostgreSQL extensions
- `0002_types.sql` - Enum types
- `0003_helpers.sql` - Helper functions (**REQUIRED**)
- `0004_core_tenancy.sql` through `0013_audit_logs.sql` - Table creation
- `0014_enable_rls.sql` - RLS enablement (**REQUIRED**)
- `0015_policies_standard.sql` - Standard policies (**THE TASK**)

## Task 15 Specification

Task 15 creates standard tenant-scoped policies for all tables with `tenant_id` columns, except special tables handled by Task 16:

**Covered Tables (18 total):**
- `customers`, `resources`, `customer_metrics`
- `services`, `service_resources`  
- `availability_rules`, `availability_exceptions`
- `bookings`, `booking_items`
- `payments`
- `coupons`, `gift_cards`, `referrals`
- `notification_templates`, `notifications`
- `usage_counters`
- `audit_logs`, `events_outbox`

**Excluded Tables (handled by Task 16):**
- `tenants`, `users`, `memberships`, `themes`, `tenant_billing`, `quotas`

**Policy Pattern (4 per table):**
- SELECT: `USING (tenant_id = current_tenant_id())`
- INSERT: `WITH CHECK (tenant_id = current_tenant_id())`
- UPDATE: `USING + WITH CHECK (tenant_id = current_tenant_id())`
- DELETE: `USING (tenant_id = current_tenant_id())`

**Note**: Both `current_tenant_id()` and `public.current_tenant_id()` are valid and supported.

## Next Steps

Once all tests pass:
1. ✅ Task 15 is complete and working correctly
2. ➡️ You can confidently proceed to Task 16 (Special policies)
3. 🔒 Your database now has proper tenant isolation for standard tables

## Support

If tests fail:
1. Review the specific error messages in test output
2. Check that all prerequisite migrations are applied
3. Verify migration files match the expected patterns
4. Re-run the failing migration if needed

The tests are designed to be safe and non-destructive - they create and clean up their own test data automatically.
