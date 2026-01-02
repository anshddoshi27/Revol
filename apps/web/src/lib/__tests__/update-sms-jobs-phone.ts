/**
 * Update phone numbers in pending/failed SMS jobs
 * 
 * Usage:
 *   npx tsx apps/web/src/lib/__tests__/update-sms-jobs-phone.ts
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

async function updateSMSJobsPhone() {
  console.log('📱 Updating SMS jobs with correct phone numbers...\n');
  
  const supabase = createAdminClient();
  
  // Get all pending/failed SMS jobs
  const { data: jobs, error: jobsError } = await supabase
    .from('notification_jobs')
    .select(`
      id,
      booking_id,
      recipient_phone,
      status,
      bookings:booking_id (
        customer_id,
        customers:customer_id (
          phone
        )
      )
    `)
    .eq('channel', 'sms')
    .in('status', ['pending', 'failed'])
    .order('created_at', { ascending: false })
    .limit(20);
  
  if (jobsError) {
    console.error('❌ Error fetching jobs:', jobsError);
    process.exit(1);
  }
  
  if (!jobs || jobs.length === 0) {
    console.log('✅ No pending/failed SMS jobs found');
    return;
  }
  
  console.log(`📊 Found ${jobs.length} SMS job(s) to check\n`);
  
  let updated = 0;
  for (const job of jobs) {
    const booking = job.bookings as any;
    const customer = booking?.customers;
    const correctPhone = customer?.phone;
    
    if (!correctPhone) {
      console.log(`⚠️  Job ${job.id.substring(0, 8)}... - Customer has no phone number`);
      continue;
    }
    
    if (job.recipient_phone === correctPhone) {
      console.log(`✅ Job ${job.id.substring(0, 8)}... - Phone number already correct`);
      continue;
    }
    
    console.log(`🔧 Updating job ${job.id.substring(0, 8)}...`);
    console.log(`   Old: ${job.recipient_phone}`);
    console.log(`   New: ${correctPhone}`);
    
    const { error: updateError } = await supabase
      .from('notification_jobs')
      .update({
        recipient_phone: correctPhone,
        status: 'pending', // Reset to pending
        last_error: null,
        attempt_count: 0,
        scheduled_at: new Date().toISOString(),
      })
      .eq('id', job.id);
    
    if (updateError) {
      console.error(`   ❌ Error: ${updateError.message}`);
    } else {
      console.log(`   ✅ Updated\n`);
      updated++;
    }
  }
  
  console.log(`\n📊 Summary: ${updated} job(s) updated`);
  
  if (updated > 0) {
    console.log('\n💡 Next step: Process the updated jobs');
    console.log('   npx tsx apps/web/src/lib/__tests__/process-notifications.ts');
  }
}

updateSMSJobsPhone()
  .then(() => {
    console.log('\n✅ Complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

