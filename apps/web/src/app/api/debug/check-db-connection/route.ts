import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db';

/**
 * GET /api/debug/check-db-connection
 * Diagnostic endpoint to check:
 * 1. Which Supabase project the app is connected to
 * 2. What the businesses.user_id foreign key constraint actually references
 * 3. Whether the constraint is correct
 */
export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const projectRef = supabaseUrl ? new URL(supabaseUrl).hostname.split('.')[0] : 'unknown';
    
    const adminSupabase = createAdminClient();
    
    // Check 1: Try to query businesses table
    const { data: businesses, error: businessesError } = await adminSupabase
      .from('businesses')
      .select('id, user_id, name')
      .limit(1);
    
    // Check 2: Try to query the constraint information
    // We can't directly query information_schema via Supabase client easily,
    // but we can try to insert a test record to see what error we get
    
    // Check 3: Try to get a user from auth.users (this will tell us if auth schema is accessible)
    const { data: { users }, error: authError } = await adminSupabase.auth.admin.listUsers({
      page: 1,
      perPage: 1
    });
    
    return NextResponse.json({
      connection: {
        supabaseUrl: supabaseUrl ? supabaseUrl.replace(/\/\/.*@/, '//***@') : 'NOT SET',
        projectRef: projectRef,
        connected: !businessesError,
      },
      database: {
        businessesTableAccessible: !businessesError,
        businessesError: businessesError?.message,
        sampleBusinesses: businesses?.length || 0,
      },
      auth: {
        authUsersAccessible: !authError,
        authError: authError?.message,
        sampleUsers: users?.length || 0,
      },
      constraintCheck: {
        note: 'To check the constraint, run this SQL in Supabase Dashboard:',
        sql: `
          SELECT 
            ccu.table_schema AS referenced_schema,
            ccu.table_name AS referenced_table
          FROM information_schema.table_constraints tc
          JOIN information_schema.constraint_column_usage ccu 
            ON ccu.constraint_name = tc.constraint_name
          WHERE tc.table_name = 'businesses'
            AND tc.constraint_name = 'businesses_user_id_fkey'
            AND tc.constraint_type = 'FOREIGN KEY';
        `,
        expected: {
          referenced_schema: 'auth',
          referenced_table: 'users'
        }
      },
      instructions: [
        '1. Check the projectRef above matches your TITHI2 project',
        '2. If businessesTableAccessible is false, check your SUPABASE_SERVICE_ROLE_KEY',
        '3. Run the SQL query above in Supabase Dashboard to check the constraint',
        '4. If constraint shows "public.users", run FIX_CONSTRAINT_TITHI2.sql again'
      ]
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to check database connection',
      message: error instanceof Error ? error.message : 'Unknown error',
      details: error
    }, { status: 500 });
  }
}



