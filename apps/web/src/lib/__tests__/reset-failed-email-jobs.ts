/**
 * Reset failed email jobs back to pending (for testing after fixes)
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

async function resetFailedEmailJobs() {
  const supabase = createAdminClient();
  
  // Reset failed email jobs back to pending
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('notification_jobs')
    .update({
      status: 'pending',
      attempt_count: 0,
      last_error: null,
      next_retry_at: null,
      scheduled_at: now, // Reset to now so they can be processed immediately
    })
    .eq('channel', 'email')
    .eq('status', 'failed')
    .select();
  
  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
  
  console.log(`✅ Reset ${data?.length || 0} failed email job(s) back to pending`);
  if (data && data.length > 0) {
    console.log('   Job IDs:', data.map(j => j.id.substring(0, 8)).join(', '));
  }
}

resetFailedEmailJobs()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

