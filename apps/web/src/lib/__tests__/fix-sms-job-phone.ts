/**
 * Fix phone number in SMS job
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

async function fixSMSJobPhone() {
  const supabase = createAdminClient();
  
  // Get most recent pending/failed SMS job
  const { data: jobs, error: jobsError } = await supabase
    .from('notification_jobs')
    .select('id, recipient_phone, booking_id')
    .eq('channel', 'sms')
    .in('status', ['pending', 'failed'])
    .order('created_at', { ascending: false })
    .limit(1);
  
  if (jobsError || !jobs || jobs.length === 0) {
    console.log('No pending/failed SMS jobs found');
    return;
  }
  
  const job = jobs[0];
  console.log(`Updating job ${job.id.substring(0, 8)}...`);
  console.log(`Old phone: ${job.recipient_phone}`);
  
  const { error } = await supabase
    .from('notification_jobs')
    .update({
      recipient_phone: '+19087237864',
      status: 'pending',
      last_error: null,
      attempt_count: 0,
      scheduled_at: new Date().toISOString(),
    })
    .eq('id', job.id);
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('✅ Updated to: +19087237864');
  }
}

fixSMSJobPhone()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });

