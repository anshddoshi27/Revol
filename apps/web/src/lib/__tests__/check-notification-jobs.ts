/**
 * Check Notification Jobs Status
 * 
 * This script checks the status of notification jobs in the database
 * 
 * Usage:
 *   npx tsx apps/web/src/lib/__tests__/check-notification-jobs.ts
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const currentDir = dirname(__filename);
const envPath = resolve(currentDir, '../../../.env');
const envLocalPath = resolve(currentDir, '../../../.env.local');
config({ path: envPath });
config({ path: envLocalPath, override: false });

import { createAdminClient } from '../db';

async function checkNotificationJobs() {
  console.log('🔍 Checking notification jobs...\n');
  
  const supabase = createAdminClient();
  
  // Get recent jobs - check all statuses
  const { data: jobs, error } = await supabase
    .from('notification_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);
  
  if (error) {
    console.error('❌ Error fetching jobs:', error);
    process.exit(1);
  }
  
  if (!jobs || jobs.length === 0) {
    console.log('⚠️  No notification jobs found');
    console.log('   This could mean:');
    console.log('   - No bookings have been created yet');
    console.log('   - Business has notifications disabled (Basic Plan)');
    console.log('   - Feature flag is disabled');
    return;
  }
  
  console.log(`📊 Found ${jobs.length} notification job(s):\n`);
  
  jobs.forEach((job, index) => {
    console.log(`${index + 1}. Job ID: ${job.id}`);
    console.log(`   Trigger: ${job.trigger}`);
    console.log(`   Channel: ${job.channel}`);
    console.log(`   Status: ${job.status}`);
    console.log(`   To Email: ${job.recipient_email || 'N/A'}`);
    console.log(`   To Phone: ${job.recipient_phone || 'N/A'}`);
    console.log(`   Scheduled At: ${job.scheduled_at ? new Date(job.scheduled_at).toLocaleString() : 'N/A'}`);
    console.log(`   Created At: ${new Date(job.created_at).toLocaleString()}`);
    if (job.sent_at) {
      console.log(`   Sent At: ${new Date(job.sent_at).toLocaleString()}`);
    }
    if (job.last_error) {
      console.log(`   ❌ Error: ${job.last_error}`);
    }
    if (job.attempt_count > 0) {
      console.log(`   Attempt Count: ${job.attempt_count}`);
    }
    if (job.next_retry_at) {
      console.log(`   Next Retry: ${new Date(job.next_retry_at).toLocaleString()}`);
    }
    if (job.provider_message_id) {
      console.log(`   Provider Message ID: ${job.provider_message_id}`);
    }
    console.log('');
  });
  
  // Summary
  const pending = jobs.filter(j => j.status === 'pending').length;
  const inProgress = jobs.filter(j => j.status === 'in_progress').length;
  const sent = jobs.filter(j => j.status === 'sent').length;
  const failed = jobs.filter(j => j.status === 'failed').length;
  const dead = jobs.filter(j => j.status === 'dead').length;
  
  console.log('📈 Summary:');
  console.log(`   Pending: ${pending}`);
  console.log(`   In Progress: ${inProgress}`);
  console.log(`   Sent: ${sent}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Dead: ${dead}`);
  console.log('');
  
  // Check if any jobs are ready to process
  const now = new Date().toISOString();
  const readyToProcess = jobs.filter(j => 
    j.status === 'pending' && 
    j.scheduled_at && 
    new Date(j.scheduled_at) <= new Date(now)
  );
  
  if (readyToProcess.length > 0) {
    console.log(`⏰ ${readyToProcess.length} job(s) ready to process (scheduled_at <= now)`);
    console.log('   Run the cron job to process them:');
    console.log('   npx tsx apps/web/src/lib/__tests__/process-notifications.ts');
  }
  
  // Check for failed jobs that can be retried
  const canRetry = jobs.filter(j => 
    j.status === 'failed' && 
    (j.attempt_count || 0) < 3 &&
    j.next_retry_at &&
    new Date(j.next_retry_at) <= new Date(now)
  );
  
  if (canRetry.length > 0) {
    console.log(`🔄 ${canRetry.length} failed job(s) ready to retry`);
  }
}

checkNotificationJobs()
  .then(() => {
    console.log('✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

