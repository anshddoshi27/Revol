/**
 * Check Recent Notification Jobs (last 5 minutes)
 * 
 * Usage:
 *   npx tsx apps/web/src/lib/__tests__/check-recent-jobs.ts
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const currentDir = dirname(__filename);
const envPath = resolve(currentDir, '../../../.env');
const envLocalPath = resolve(currentDir, '../../../.env.local');
config({ path: envPath });
config({ path: envLocalPath, override: false });

import { createAdminClient } from '../db';

async function checkRecentJobs() {
  console.log('🔍 Checking recent notification jobs (last 5 minutes)...\n');
  
  const supabase = createAdminClient();
  
  // Get jobs from last 5 minutes
  const fiveMinutesAgo = new Date();
  fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);
  
  const { data: jobs, error } = await supabase
    .from('notification_jobs')
    .select('*')
    .gte('created_at', fiveMinutesAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(20);
  
  if (error) {
    console.error('❌ Error fetching jobs:', error);
    process.exit(1);
  }
  
  if (!jobs || jobs.length === 0) {
    console.log('⚠️  No notification jobs found in the last 5 minutes');
    console.log('   This could mean:');
    console.log('   - No bookings were created');
    console.log('   - Business has notifications disabled');
    console.log('   - Notification job creation failed');
    return;
  }
  
  console.log(`📊 Found ${jobs.length} recent job(s):\n`);
  
  jobs.forEach((job, index) => {
    console.log(`${index + 1}. Job ID: ${job.id}`);
    console.log(`   Trigger: ${job.trigger}`);
    console.log(`   Channel: ${job.channel}`);
    console.log(`   Status: ${job.status}`);
    console.log(`   To Email: ${job.recipient_email || 'N/A'}`);
    console.log(`   To Phone: ${job.recipient_phone || 'N/A'}`);
    console.log(`   Booking ID: ${job.booking_id || 'N/A'}`);
    console.log(`   Created: ${new Date(job.created_at).toLocaleString()}`);
    if (job.last_error) {
      console.log(`   ❌ Error: ${job.last_error}`);
    }
    if (job.sent_at) {
      console.log(`   ✅ Sent: ${new Date(job.sent_at).toLocaleString()}`);
    }
    console.log('');
  });
}

checkRecentJobs()
  .then(() => {
    console.log('✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

