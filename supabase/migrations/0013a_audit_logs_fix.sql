-- Quick fix for audit function to handle tables without id column
-- This ensures the updated function is properly deployed

CREATE OR REPLACE FUNCTION public.log_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    tenant_id_val uuid;
    user_id_val uuid;
    record_id_val uuid;
    has_id_column boolean;
BEGIN
    -- Check if the table has an 'id' column
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = TG_TABLE_SCHEMA 
        AND table_name = TG_TABLE_NAME 
        AND column_name = 'id'
    ) INTO has_id_column;

    -- Extract tenant_id from the row (OLD for DELETE, NEW for INSERT/UPDATE)
    IF TG_OP = 'DELETE' THEN
        tenant_id_val := (OLD.tenant_id)::uuid;
        -- Only try to extract id if the column exists
        IF has_id_column THEN
            record_id_val := (OLD.id)::uuid;
        ELSE
            record_id_val := NULL;
        END IF;
    ELSE
        tenant_id_val := (NEW.tenant_id)::uuid;
        -- Only try to extract id if the column exists
        IF has_id_column THEN
            record_id_val := (NEW.id)::uuid;
        ELSE
            record_id_val := NULL;
        END IF;
    END IF;

    -- Get current user from JWT helper
    user_id_val := public.current_user_id();

    -- Insert audit record
    INSERT INTO public.audit_logs (
        tenant_id,
        table_name,
        operation,
        record_id,
        old_data,
        new_data,
        user_id,
        created_at
    ) VALUES (
        tenant_id_val,
        TG_TABLE_NAME,
        TG_OP,
        record_id_val,
        CASE WHEN TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE NULL END,
        user_id_val,
        now()
    );

    -- Return appropriate record based on operation
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;
