/**
 * Helper script to fix business user_id association
 * 
 * This script finds the business with subdomain "demo" and updates it to belong
 * to the specified user email.
 * 
 * Usage:
 *   npx tsx scripts/fix-business-user.ts <user-email>
 * 
 * Example:
 *   npx tsx scripts/fix-business-user.ts demo@revol.dev
 */

// Load environment variables
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../.env') });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

async function fixBusinessUser(email: string) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const authClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log(`🔍 Looking for user: ${email}...`);

  // Find user by email
  const { data: users, error: listError } = await authClient.auth.admin.listUsers();
  
  if (listError) {
    throw new Error(`Failed to list users: ${listError.message}`);
  }

  const user = users?.users.find(u => u.email === email);

  if (!user) {
    throw new Error(`User with email ${email} not found`);
  }

  console.log(`✓ Found user: ${user.email} (ID: ${user.id})`);

  // Find business with subdomain "demo"
  console.log(`\n🔍 Looking for business with subdomain "demo"...`);
  
  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .select('id, user_id, name, subdomain')
    .eq('subdomain', 'demo')
    .is('deleted_at', null)
    .maybeSingle();

  if (businessError) {
    throw new Error(`Failed to query business: ${businessError.message}`);
  }

  if (!business) {
    throw new Error('Business with subdomain "demo" not found. Run the seed script first.');
  }

  console.log(`✓ Found business: ${business.name} (ID: ${business.id})`);
  console.log(`   Current user_id: ${business.user_id}`);

  if (business.user_id === user.id) {
    console.log(`\n✅ Business already belongs to this user. No update needed.`);
    return;
  }

  console.log(`\n🔄 Updating business to belong to user ${user.email}...`);

  // Update business user_id
  const { error: updateError } = await supabase
    .from('businesses')
    .update({ user_id: user.id })
    .eq('id', business.id);

  if (updateError) {
    throw new Error(`Failed to update business: ${updateError.message}`);
  }

  console.log(`✅ Business updated successfully!`);
  console.log(`\nYou can now log in with:`);
  console.log(`  Email: ${email}`);
  console.log(`  Business: ${business.name}`);
  console.log(`  Business ID: ${business.id}`);
}

// Get command line arguments
const email = process.argv[2];

if (!email) {
  console.error('Usage: npx tsx scripts/fix-business-user.ts <user-email>');
  console.error('Example: npx tsx scripts/fix-business-user.ts demo@revol.dev');
  process.exit(1);
}

fixBusinessUser(email).catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});

