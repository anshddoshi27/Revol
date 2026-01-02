/**
 * Create SMS notification job for an existing booking
 * 
 * Usage:
 *   npx tsx apps/web/src/lib/__tests__/create-sms-for-booking.ts [bookingId]
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
import { emitNotification } from '../notifications';

async function createSMSForBooking(bookingId?: string) {
  console.log('📱 Creating SMS notification for booking...\n');
  
  const supabase = createAdminClient();
  
  // Get most recent booking if not specified
  let booking;
  if (bookingId) {
    const { data, error } = await supabase
      .from('bookings')
      .select('id, business_id')
      .eq('id', bookingId)
      .single();
    
    if (error || !data) {
      console.error(`❌ Booking ${bookingId} not found`);
      process.exit(1);
    }
    booking = data;
  } else {
    const { data, error } = await supabase
      .from('bookings')
      .select('id, business_id')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error || !data) {
      console.error('❌ No bookings found');
      process.exit(1);
    }
    booking = data;
  }
  
  console.log(`📦 Booking ID: ${booking.id}`);
  console.log(`   Business ID: ${booking.business_id}\n`);
  
  // Re-trigger notification (this will create SMS job if template exists)
  console.log('🔄 Re-triggering notification...');
  try {
    await emitNotification(booking.business_id, 'booking_created', booking.id, supabase);
    console.log('✅ Notification triggered successfully!\n');
    
    // Check if SMS job was created
    const { data: jobs, error: jobsError } = await supabase
      .from('notification_jobs')
      .select('*')
      .eq('booking_id', booking.id)
      .eq('channel', 'sms')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (jobsError) {
      console.error('❌ Error checking jobs:', jobsError);
      return;
    }
    
    if (jobs && jobs.length > 0) {
      const smsJob = jobs[0];
      console.log('✅ SMS job created!');
      console.log(`   Job ID: ${smsJob.id}`);
      console.log(`   Status: ${smsJob.status}`);
      console.log(`   To: ${smsJob.recipient_phone}\n`);
      
      if (smsJob.status === 'pending') {
        console.log('⏳ Job is pending - processing now...');
        // Process it
        const response = await fetch('http://localhost:3000/api/cron/notifications', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${process.env.CRON_SECRET || '8083fa6c-4a5b-4c5d-6e7f-8a9b0c1d2e3f'}`,
          },
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('✅ Cron job executed:', result);
        } else {
          console.log('⚠️  Could not auto-process. Run manually:');
          console.log('   npx tsx apps/web/src/lib/__tests__/process-notifications.ts');
        }
      }
    } else {
      console.log('⚠️  No SMS job was created.');
      console.log('   Possible reasons:');
      console.log('   - Customer has no phone number');
      console.log('   - SMS template not enabled');
      console.log('   - Template not found\n');
    }
  } catch (error) {
    console.error('❌ Error triggering notification:', error);
    process.exit(1);
  }
}

const bookingId = process.argv[2];
createSMSForBooking(bookingId)
  .then(() => {
    console.log('✅ Complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

