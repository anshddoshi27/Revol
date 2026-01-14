/**
 * Check ALL Notification Jobs (including failed/dead)
 * 
 * Usage:
 *   npx tsx apps/web/src/lib/__tests__/check-all-jobs.ts
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

async function checkAllJobs() {
  console.log('🔍 Checking ALL notification jobs...\n');
  
  const supabase = createAdminClient();
  
  // Get ALL jobs (all statuses)
  const { data: jobs, error } = await supabase
    .from('notification_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  
  if (error) {
    console.error('❌ Error fetching jobs:', error);
    process.exit(1);
  }
  
  if (!jobs || jobs.length === 0) {
    console.log('⚠️  No notification jobs found');
    return;
  }
  
  console.log(`📊 Found ${jobs.length} notification job(s) total:\n`);
  
  // Group by status
  const byStatus: Record<string, typeof jobs> = {};
  jobs.forEach(job => {
    const status = job.status || 'unknown';
    if (!byStatus[status]) {
      byStatus[status] = [];
    }
    byStatus[status].push(job);
  });
  
  // Show by status
  Object.entries(byStatus).forEach(([status, statusJobs]) => {
    console.log(`\n📦 ${status.toUpperCase()} (${statusJobs.length}):`);
    statusJobs.forEach((job, index) => {
      console.log(`\n   ${index + 1}. Job ID: ${job.id}`);
      console.log(`      Trigger: ${job.trigger}`);
      console.log(`      Channel: ${job.channel}`);
      console.log(`      Status: ${job.status}`);
      console.log(`      To Email: ${job.recipient_email || 'N/A'}`);
      console.log(`      To Phone: ${job.recipient_phone || 'N/A'}`);
      console.log(`      Created: ${new Date(job.created_at).toLocaleString()}`);
      if (job.scheduled_at) {
        console.log(`      Scheduled: ${new Date(job.scheduled_at).toLocaleString()}`);
      }
      if (job.sent_at) {
        console.log(`      ✅ Sent: ${new Date(job.sent_at).toLocaleString()}`);
      }
      if (job.last_error) {
        console.log(`      ❌ Error: ${job.last_error}`);
      }
      if (job.attempt_count > 0) {
        console.log(`      Attempts: ${job.attempt_count}`);
      }
      if (job.next_retry_at) {
        console.log(`      Next Retry: ${new Date(job.next_retry_at).toLocaleString()}`);
      }
      if (job.provider_message_id) {
        console.log(`      Provider ID: ${job.provider_message_id}`);
      }
    });
  });
  
  // Summary
  const pending = jobs.filter(j => j.status === 'pending').length;
  const inProgress = jobs.filter(j => j.status === 'in_progress').length;
  const sent = jobs.filter(j => j.status === 'sent').length;
  const failed = jobs.filter(j => j.status === 'failed').length;
  const dead = jobs.filter(j => j.status === 'dead').length;
  
  console.log('\n\n📈 Summary:');
  console.log(`   Pending: ${pending}`);
  console.log(`   In Progress: ${inProgress}`);
  console.log(`   Sent: ${sent}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Dead: ${dead}`);
  console.log(`   Total: ${jobs.length}`);
}

checkAllJobs()
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

