-- Task 12 Business Rules Validation
-- Focused tests for specific business logic and edge cases
-- Complementary to main validation script

DO $$
DECLARE
    test_tenant_id uuid;
    test_result_count integer;
    test_boolean_result boolean;
    current_updated_at timestamptz;
    new_updated_at timestamptz;
    test_quota_id uuid;
BEGIN
    RAISE NOTICE 'Starting Task 12 Business Rules Validation';
    RAISE NOTICE '==========================================';
    
    -- Get or create test tenant
    SELECT id INTO test_tenant_id FROM public.tenants LIMIT 1;
    IF test_tenant_id IS NULL THEN
        INSERT INTO public.tenants (slug, tz) 
        VALUES ('test-business-rules-' || extract(epoch from now())::text, 'UTC') 
        RETURNING id INTO test_tenant_id;
    END IF;
    
    RAISE NOTICE 'Using tenant: %', test_tenant_id;
    
    -- ====================================================================
    -- TEST 1: APPLICATION-MANAGED COUNTERS VALIDATION
    -- Verify usage_counters support the intended application patterns
    -- ====================================================================
    
    RAISE NOTICE 'Test 1: Application-Managed Counters Validation';
    
    -- Test 1.1: Multiple periods for same code (monthly tracking)
    BEGIN
        INSERT INTO public.usage_counters (tenant_id, code, period_start, period_end, current_count) VALUES
        (test_tenant_id, 'bookings', '2024-01-01', '2024-01-31', 25),
        (test_tenant_id, 'bookings', '2024-02-01', '2024-02-29', 30),
        (test_tenant_id, 'bookings', '2024-03-01', '2024-03-31', 22);
        
        SELECT COUNT(*) INTO test_result_count 
        FROM public.usage_counters 
        WHERE tenant_id = test_tenant_id AND code = 'bookings';
        
        IF test_result_count != 3 THEN
            RAISE EXCEPTION 'Multiple periods test failed: expected 3, got %', test_result_count;
        END IF;
        
        RAISE NOTICE '✓ Multiple periods for same code supported';
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Application-managed counters test failed: %', SQLERRM;
    END;
    
    -- Test 1.2: Different codes for same tenant
    BEGIN
        INSERT INTO public.usage_counters (tenant_id, code, period_start, period_end, current_count) VALUES
        (test_tenant_id, 'customers', '2024-01-01', '2024-01-31', 15),
        (test_tenant_id, 'payments', '2024-01-01', '2024-01-31', 12),
        (test_tenant_id, 'notifications', '2024-01-01', '2024-01-31', 85);
        
        SELECT COUNT(*) INTO test_result_count 
        FROM public.usage_counters 
        WHERE tenant_id = test_tenant_id 
        AND period_start = '2024-01-01' 
        AND code IN ('customers', 'payments', 'notifications');
        
        IF test_result_count != 3 THEN
            RAISE EXCEPTION 'Different codes test failed: expected 3, got %', test_result_count;
        END IF;
        
        RAISE NOTICE '✓ Different tracking codes for same tenant supported';
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Different codes test failed: %', SQLERRM;
    END;
    
    -- Test 1.3: Verify no automatic incrementing (application managed)
    -- This is validated by absence of triggers, already tested in main script
    RAISE NOTICE '✓ Application-managed pattern confirmed (no auto-increment triggers)';
    
    -- ====================================================================
    -- TEST 2: QUOTA ENFORCEMENT ENVELOPE VALIDATION
    -- Test quota configuration for different enforcement scenarios
    -- ====================================================================
    
    RAISE NOTICE 'Test 2: Quota Enforcement Envelope Validation';
    
    -- Test 2.1: All period types supported per Design Brief
    BEGIN
        INSERT INTO public.quotas (tenant_id, code, limit_value, period_type, is_active) VALUES
        (test_tenant_id, 'daily_bookings', 10, 'daily', true),
        (test_tenant_id, 'weekly_bookings', 50, 'weekly', true),
        (test_tenant_id, 'monthly_bookings', 200, 'monthly', true),
        (test_tenant_id, 'yearly_bookings', 2000, 'yearly', true);
        
        SELECT COUNT(*) INTO test_result_count 
        FROM public.quotas 
        WHERE tenant_id = test_tenant_id 
        AND code LIKE '%_bookings';
        
        IF test_result_count != 4 THEN
            RAISE EXCEPTION 'Period types test failed: expected 4, got %', test_result_count;
        END IF;
        
        RAISE NOTICE '✓ All period types (daily/weekly/monthly/yearly) supported';
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Period types test failed: %', SQLERRM;
    END;
    
    -- Test 2.2: Active/inactive quota toggle
    BEGIN
        INSERT INTO public.quotas (tenant_id, code, limit_value, period_type, is_active) VALUES
        (test_tenant_id, 'inactive_test', 100, 'monthly', false);
        
        SELECT is_active INTO test_boolean_result 
        FROM public.quotas 
        WHERE tenant_id = test_tenant_id AND code = 'inactive_test';
        
        IF test_boolean_result != false THEN
            RAISE EXCEPTION 'Inactive quota test failed';
        END IF;
        
        RAISE NOTICE '✓ Active/inactive quota toggle working';
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Active/inactive test failed: %', SQLERRM;
    END;
    
    -- Test 2.3: Zero limit quota (unlimited or disabled)
    BEGIN
        INSERT INTO public.quotas (tenant_id, code, limit_value, period_type) VALUES
        (test_tenant_id, 'unlimited_test', 0, 'monthly');
        
        SELECT limit_value INTO test_result_count 
        FROM public.quotas 
        WHERE tenant_id = test_tenant_id AND code = 'unlimited_test';
        
        IF test_result_count != 0 THEN
            RAISE EXCEPTION 'Zero limit test failed';
        END IF;
        
        RAISE NOTICE '✓ Zero limit quotas supported (unlimited scenarios)';
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Zero limit test failed: %', SQLERRM;
    END;
    
    -- ====================================================================
    -- TEST 3: METADATA AND EXTENSIBILITY VALIDATION
    -- Test JSONB metadata fields for future extensibility
    -- ====================================================================
    
    RAISE NOTICE 'Test 3: Metadata and Extensibility Validation';
    
    -- Test 3.1: Usage counter metadata
    BEGIN
        INSERT INTO public.usage_counters (
            tenant_id, code, period_start, period_end, current_count, metadata
        ) VALUES (
            test_tenant_id, 'metadata_test', '2024-01-01', '2024-01-31', 5,
            '{"source": "api", "category": "bookings", "tags": ["premium", "automated"]}'::jsonb
        );
        
        SELECT jsonb_extract_path_text(metadata, 'source') INTO test_result_count::text
        FROM public.usage_counters 
        WHERE tenant_id = test_tenant_id AND code = 'metadata_test';
        
        IF test_result_count::text != 'api' THEN
            RAISE EXCEPTION 'Usage counter metadata test failed';
        END IF;
        
        RAISE NOTICE '✓ Usage counter metadata (JSONB) working correctly';
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Usage counter metadata test failed: %', SQLERRM;
    END;
    
    -- Test 3.2: Quota metadata
    BEGIN
        INSERT INTO public.quotas (
            tenant_id, code, limit_value, period_type, metadata
        ) VALUES (
            test_tenant_id, 'quota_metadata_test', 100, 'monthly',
            '{"enforcement": "soft", "notifications": true, "grace_period": 3}'::jsonb
        ) RETURNING id INTO test_quota_id;
        
        SELECT jsonb_extract_path_text(metadata, 'enforcement') INTO test_result_count::text
        FROM public.quotas 
        WHERE id = test_quota_id;
        
        IF test_result_count::text != 'soft' THEN
            RAISE EXCEPTION 'Quota metadata test failed';
        END IF;
        
        RAISE NOTICE '✓ Quota metadata (JSONB) working correctly';
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Quota metadata test failed: %', SQLERRM;
    END;
    
    -- ====================================================================
    -- TEST 4: TIMESTAMP TRIGGER BEHAVIOR VALIDATION
    -- Test that quotas updated_at trigger works correctly
    -- ====================================================================
    
    RAISE NOTICE 'Test 4: Timestamp Trigger Behavior Validation';
    
    -- Test 4.1: Insert sets updated_at
    SELECT updated_at INTO current_updated_at 
    FROM public.quotas 
    WHERE id = test_quota_id;
    
    IF current_updated_at IS NULL THEN
        RAISE EXCEPTION 'Insert updated_at trigger failed';
    END IF;
    RAISE NOTICE '✓ Insert sets updated_at timestamp';
    
    -- Test 4.2: Update advances updated_at
    BEGIN
        -- Small delay to ensure timestamp difference
        PERFORM pg_sleep(0.01);
        
        UPDATE public.quotas 
        SET limit_value = 150 
        WHERE id = test_quota_id;
        
        SELECT updated_at INTO new_updated_at 
        FROM public.quotas 
        WHERE id = test_quota_id;
        
        IF new_updated_at <= current_updated_at THEN
            RAISE EXCEPTION 'Update updated_at trigger failed: % <= %', new_updated_at, current_updated_at;
        END IF;
        
        RAISE NOTICE '✓ Update advances updated_at timestamp';
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Update timestamp test failed: %', SQLERRM;
    END;
    
    -- ====================================================================
    -- TEST 5: EDGE CASE AND BOUNDARY VALIDATION
    -- Test boundary conditions and edge cases
    -- ====================================================================
    
    RAISE NOTICE 'Test 5: Edge Case and Boundary Validation';
    
    -- Test 5.1: Same day period (period_start = period_end)
    BEGIN
        INSERT INTO public.usage_counters (
            tenant_id, code, period_start, period_end, current_count
        ) VALUES (
            test_tenant_id, 'same_day', '2024-01-01', '2024-01-01', 1
        );
        
        RAISE NOTICE '✓ Same day period (start = end) allowed';
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Same day period test failed: %', SQLERRM;
    END;
    
    -- Test 5.2: Large count values
    BEGIN
        INSERT INTO public.usage_counters (
            tenant_id, code, period_start, period_end, current_count
        ) VALUES (
            test_tenant_id, 'large_count', '2024-01-01', '2024-01-31', 999999999
        );
        
        RAISE NOTICE '✓ Large count values supported';
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Large count test failed: %', SQLERRM;
    END;
    
    -- Test 5.3: Large limit values
    BEGIN
        INSERT INTO public.quotas (
            tenant_id, code, limit_value, period_type
        ) VALUES (
            test_tenant_id, 'large_limit', 999999999, 'yearly'
        );
        
        RAISE NOTICE '✓ Large limit values supported';
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Large limit test failed: %', SQLERRM;
    END;
    
    -- Test 5.4: Empty metadata (default behavior)
    BEGIN
        INSERT INTO public.usage_counters (
            tenant_id, code, period_start, period_end, current_count
        ) VALUES (
            test_tenant_id, 'empty_metadata', '2024-01-01', '2024-01-31', 0
        );
        
        SELECT metadata INTO test_result_count::jsonb
        FROM public.usage_counters 
        WHERE tenant_id = test_tenant_id AND code = 'empty_metadata';
        
        IF test_result_count::jsonb != '{}'::jsonb THEN
            RAISE EXCEPTION 'Empty metadata test failed: expected {}, got %', test_result_count::jsonb;
        END IF;
        
        RAISE NOTICE '✓ Empty metadata defaults to {} correctly';
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Empty metadata test failed: %', SQLERRM;
    END;
    
    -- ====================================================================
    -- FINAL SUMMARY
    -- ====================================================================
    
    RAISE NOTICE ' ';
    RAISE NOTICE '================================================';
    RAISE NOTICE 'TASK 12 BUSINESS RULES VALIDATION - ALL PASSED';
    RAISE NOTICE '================================================';
    RAISE NOTICE 'Application-Managed Counters: ✓ Multiple periods and codes';
    RAISE NOTICE 'Quota Enforcement Envelopes: ✓ All period types supported';
    RAISE NOTICE 'Metadata Extensibility: ✓ JSONB fields working correctly';
    RAISE NOTICE 'Timestamp Triggers: ✓ quotas updated_at working correctly';
    RAISE NOTICE 'Edge Cases: ✓ Boundary conditions handled properly';
    RAISE NOTICE ' ';
    RAISE NOTICE 'Task 12 business rules implementation verified successfully.';
    
END $$;
