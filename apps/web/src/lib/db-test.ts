/**
 * Simple test script to verify Supabase connection
 * 
 * Run this with: npx tsx src/lib/db-test.ts
 * Or import and call testConnection() from an API route
 */

import { createAdminClient } from './db';

export async function testConnection() {
  try {
    console.log('Testing Supabase connection...');
    
    const supabase = createAdminClient();
    
    // Test 1: Check if we can connect
    const { data, error } = await supabase.from('businesses').select('count').limit(1);
    
    if (error) {
      // If table doesn't exist yet, that's okay - we just want to verify connection
      if (error.code === '42P01') {
        console.log('✅ Supabase connection successful!');
        console.log('ℹ️  Database tables not created yet - run migrations first');
        return { success: true, message: 'Connected, but tables not found' };
      }
      
      console.error('❌ Supabase connection failed:', error.message);
      return { success: false, error: error.message };
    }
    
    console.log('✅ Supabase connection successful!');
    console.log('✅ Database tables exist');
    return { success: true, message: 'Connected and tables exist' };
  } catch (error) {
    console.error('❌ Connection test failed:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// Allow running directly
if (require.main === module) {
  testConnection()
    .then((result) => {
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}




