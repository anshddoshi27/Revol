import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db';

/**
 * GET /api/debug/check-constraint
 * Diagnostic endpoint to check what the businesses.user_id foreign key actually references
 */
export async function GET() {
  try {
    const adminSupabase = createAdminClient();
    
    // Query to check the actual foreign key constraint
    const { data, error } = await adminSupabase.rpc('exec_sql', {
      query: `
        SELECT 
          tc.constraint_name,
          tc.table_name,
          kcu.column_name,
          ccu.table_schema AS referenced_schema,
          ccu.table_name AS referenced_table,
          ccu.column_name AS referenced_column
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu 
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.table_name = 'businesses'
          AND tc.constraint_type = 'FOREIGN KEY'
          AND kcu.column_name = 'user_id';
      `
    });
    
    if (error) {
      // RPC might not exist, try direct query via raw SQL
      // Actually, we can't do raw SQL easily with Supabase client
      // Let's return instructions instead
      return NextResponse.json({
        error: 'Cannot query constraint directly via API',
        instructions: [
          '1. Go to Supabase Dashboard > SQL Editor',
          '2. Run the query from check-constraint.sql',
          '3. Or run FIX_CONSTRAINT_NOW.sql to fix it'
        ],
        currentError: error.message
      });
    }
    
    return NextResponse.json({
      constraint: data,
      status: data?.[0]?.referenced_schema === 'auth' && data?.[0]?.referenced_table === 'users' 
        ? 'CORRECT' 
        : 'INCORRECT - Needs fix',
      expected: {
        schema: 'auth',
        table: 'users'
      }
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to check constraint',
      message: error instanceof Error ? error.message : 'Unknown error',
      manualCheck: 'Run check-constraint.sql in Supabase Dashboard > SQL Editor'
    }, { status: 500 });
  }
}



