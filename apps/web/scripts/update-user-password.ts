/**
 * Helper script to update user password via Supabase Admin API
 * 
 * Usage:
 *   npx tsx scripts/update-user-password.ts <email> <new-password>
 * 
 * Example:
 *   npx tsx scripts/update-user-password.ts demo@tithi.com Demo123!
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

async function updatePassword(email: string, newPassword: string) {
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
  console.log(`🔄 Updating password...`);

  // Update password
  const { error: updateError } = await authClient.auth.admin.updateUserById(user.id, {
    password: newPassword,
  });

  if (updateError) {
    console.error(`❌ Failed to update password: ${updateError.message}`);
    console.error(`\nThis might be because:`);
    console.error(`1. Supabase admin API doesn't allow password updates directly`);
    console.error(`2. Password doesn't meet requirements`);
    console.error(`\nTry using "Send password recovery" in Supabase Dashboard instead.`);
    process.exit(1);
  }

  console.log(`✅ Password updated successfully!`);
  console.log(`\nYou can now log in with:`);
  console.log(`  Email: ${email}`);
  console.log(`  Password: ${newPassword}`);
}

// Get command line arguments
const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.error('Usage: npx tsx scripts/update-user-password.ts <email> <new-password>');
  console.error('Example: npx tsx scripts/update-user-password.ts demo@tithi.com "Demo123!"');
  process.exit(1);
}

updatePassword(email, password).catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});

