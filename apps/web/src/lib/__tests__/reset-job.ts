/**
 * Reset a job back to pending (for testing)
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

async function resetJob() {
  const supabase = createAdminClient();
  
  // Reset in_progress jobs back to pending
  const { data, error } = await supabase
    .from('notification_jobs')
    .update({
      status: 'pending',
      attempt_count: 0,
    })
    .eq('status', 'in_progress')
    .select();
  
  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
  
  console.log(`✅ Reset ${data?.length || 0} job(s) back to pending`);
}

resetJob()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

