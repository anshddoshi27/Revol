import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db';

/**
 * Test endpoint to verify Supabase connection
 * 
 * GET /api/test-db
 * 
 * This endpoint tests the database connection and returns status.
 * Useful for verifying your environment variables are set correctly.
 */
export async function GET() {
  try {
    const supabase = createAdminClient();
    
    // Try to query a table (businesses should exist after migrations)
    // If table doesn't exist, we'll get a specific error
    const { data, error } = await supabase
      .from('businesses')
      .select('count')
      .limit(1);
    
    if (error) {
      // Table doesn't exist yet - connection works but migrations not run
      if (error.code === '42P01') {
        return NextResponse.json({
          success: true,
          connected: true,
          message: '✅ Supabase connection successful! Database tables not created yet - run migrations first.',
          error: error.message,
        });
      }
      
      // Other database error
      return NextResponse.json({
        success: false,
        connected: true,
        message: '❌ Database error',
        error: error.message,
        code: error.code,
      }, { status: 500 });
    }
    
    // Success - connection works and tables exist
    return NextResponse.json({
      success: true,
      connected: true,
      tablesExist: true,
      message: '✅ Supabase connection successful! Database tables exist.',
    });
  } catch (error) {
    // Connection failed - likely env vars not set
    return NextResponse.json({
      success: false,
      connected: false,
      message: '❌ Failed to connect to Supabase',
      error: error instanceof Error ? error.message : 'Unknown error',
      hint: 'Check your .env.local file has NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set',
    }, { status: 500 });
  }
}




