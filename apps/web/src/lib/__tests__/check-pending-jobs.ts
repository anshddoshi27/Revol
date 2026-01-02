/**
 * Check pending jobs and their scheduled_at times
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

async function checkPendingJobs() {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  
  console.log(`Current time: ${now}\n`);
  
  // Get all pending jobs
  const { data: jobs, error } = await supabase
    .from('notification_jobs')
    .select('*')
    .eq('status', 'pending')
    .order('scheduled_at', { ascending: true });
  
  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
  
  if (!jobs || jobs.length === 0) {
    console.log('⚠️  No pending jobs found');
    return;
  }
  
  console.log(`📊 Found ${jobs.length} pending job(s):\n`);
  
  jobs.forEach((job, index) => {
    const scheduled = new Date(job.scheduled_at);
    const nowDate = new Date(now);
    const isReady = scheduled <= nowDate;
    
    console.log(`${index + 1}. Job ID: ${job.id.substring(0, 8)}...`);
    console.log(`   Channel: ${job.channel}`);
    console.log(`   To: ${job.recipient_email || job.recipient_phone || 'N/A'}`);
    console.log(`   Scheduled: ${job.scheduled_at}`);
    console.log(`   Now: ${now}`);
    console.log(`   Ready: ${isReady ? '✅ YES' : '❌ NO (scheduled in future)'}`);
    console.log('');
  });
}

checkPendingJobs()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

