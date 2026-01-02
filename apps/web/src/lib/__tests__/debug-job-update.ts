/**
 * Debug: Check if job update is working
 * 
 * Usage:
 *   npx tsx apps/web/src/lib/__tests__/debug-job-update.ts
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

async function debugJobUpdate() {
  console.log('🔍 Debugging job update...\n');
  
  const supabase = createAdminClient();
  
  // Get the pending job
  const { data: jobs, error: fetchError } = await supabase
    .from('notification_jobs')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1);
  
  if (fetchError) {
    console.error('❌ Error fetching jobs:', fetchError);
    process.exit(1);
  }
  
  if (!jobs || jobs.length === 0) {
    console.log('⚠️  No pending jobs found');
    process.exit(0);
  }
  
  const job = jobs[0];
  console.log(`📋 Found job: ${job.id}`);
  console.log(`   Current status: ${job.status}`);
  console.log(`   Attempt count: ${job.attempt_count || 0}`);
  console.log('');
  
  // Try to update it to in_progress (like the cron does)
  console.log('🔄 Attempting to update status to "in_progress"...');
  const { data: updateData, error: updateError } = await supabase
    .from('notification_jobs')
    .update({
      status: 'in_progress',
      attempt_count: (job.attempt_count || 0) + 1,
    })
    .eq('id', job.id)
    .select();
  
  if (updateError) {
    console.error('❌ Update failed:', updateError);
    console.error('   Code:', updateError.code);
    console.error('   Message:', updateError.message);
    console.error('   Details:', updateError.details);
    console.error('   Hint:', updateError.hint);
  } else {
    console.log('✅ Update successful!');
    console.log('   Updated data:', updateData);
  }
  
  // Check the job again
  console.log('\n🔍 Checking job status again...');
  const { data: checkJob, error: checkError } = await supabase
    .from('notification_jobs')
    .select('*')
    .eq('id', job.id)
    .single();
  
  if (checkError) {
    console.error('❌ Error checking job:', checkError);
  } else {
    console.log(`   Status: ${checkJob.status}`);
    console.log(`   Attempt count: ${checkJob.attempt_count}`);
    console.log(`   Updated at: ${checkJob.updated_at}`);
  }
}

debugJobUpdate()
  .then(() => {
    console.log('\n✅ Debug complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

