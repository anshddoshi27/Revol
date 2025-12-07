/**
 * Quick script to fix subscription_status for a business
 * 
 * Usage: tsx scripts/fix-business-subscription-status.ts <business-id>
 */

import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables - try .env.local first, then .env
const envPath = path.join(__dirname, '../.env.local');
const envPathFallback = path.join(__dirname, '../.env');
dotenv.config({ path: envPath });
// If .env.local doesn't exist, try .env
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  dotenv.config({ path: envPathFallback });
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? '✓' : '✗');
  process.exit(1);
}

// Create admin client (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const BUSINESS_ID = process.argv[2] || '5c860b65-0710-4238-a92c-ea9b1da6d984';

async function fixSubscriptionStatus() {
  console.log('🔧 Fixing subscription_status for business:', BUSINESS_ID);
  
  // First, check current status
  const { data: business, error: fetchError } = await supabase
    .from('businesses')
    .select('id, name, subdomain, subscription_status')
    .eq('id', BUSINESS_ID)
    .single();
  
  if (fetchError || !business) {
    console.error('❌ Error fetching business:', fetchError?.message || 'Business not found');
    process.exit(1);
  }
  
  console.log('📋 Current business info:');
  console.log('   Name:', business.name);
  console.log('   Subdomain:', business.subdomain);
  console.log('   Current subscription_status:', business.subscription_status || 'null/undefined');
  
  // Update subscription_status to 'trial'
  const { data: updated, error: updateError } = await supabase
    .from('businesses')
    .update({
      subscription_status: 'trial',
      updated_at: new Date().toISOString(),
    })
    .eq('id', BUSINESS_ID)
    .select('id, name, subscription_status')
    .single();
  
  if (updateError) {
    console.error('❌ Error updating business:', updateError.message);
    process.exit(1);
  }
  
  console.log('✅ Successfully updated business!');
  console.log('   New subscription_status:', updated.subscription_status);
  console.log('\n🎉 Business is now ready for testing!');
}

fixSubscriptionStatus().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});

