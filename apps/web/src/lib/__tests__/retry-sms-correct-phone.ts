/**
 * Delete old SMS job and re-trigger with correct phone number
 * 
 * Usage:
 *   npx tsx apps/web/src/lib/__tests__/retry-sms-correct-phone.ts [bookingId]
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

async function retrySMSCorrectPhone(bookingId?: string) {
  console.log('🔄 Retrying SMS with correct phone number...\n');
  
  const supabase = createAdminClient();
  
  // Get most recent booking if not specified
  let booking;
  if (bookingId) {
    const { data, error } = await supabase
      .from('bookings')
      .select('id, business_id, customer_id')
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
      .select('id, business_id, customer_id')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error || !data) {
      console.error('❌ No bookings found');
      process.exit(1);
    }
    booking = data;
  }
  
  console.log(`📦 Booking ID: ${booking.id}\n`);
  
  // Delete old failed SMS jobs for this booking
  console.log('🗑️  Deleting old SMS jobs...');
  const { error: deleteError } = await supabase
    .from('notification_jobs')
    .delete()
    .eq('booking_id', booking.id)
    .eq('channel', 'sms')
    .eq('trigger', 'booking_created');
  
  if (deleteError) {
    console.error('❌ Error deleting old jobs:', deleteError);
  } else {
    console.log('✅ Old SMS jobs deleted\n');
  }
  
  // Verify customer phone is correct
  const { data: customer } = await supabase
    .from('customers')
    .select('phone')
    .eq('id', booking.customer_id)
    .single();
  
  if (customer) {
    console.log(`📞 Customer phone: ${customer.phone || 'N/A'}`);
    if (customer.phone && customer.phone.length < 12) {
      console.log('⚠️  Phone number still incomplete! Updating...');
      const { error: updateError } = await supabase
        .from('customers')
        .update({
          phone: '+19087237864',
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.customer_id);
      
      if (updateError) {
        console.error('❌ Error updating phone:', updateError);
      } else {
        console.log('✅ Phone number updated to: +19087237864\n');
      }
    } else {
      console.log('✅ Phone number looks correct\n');
    }
  }
  
  // Re-trigger notification
  console.log('🔄 Re-triggering notification...');
  try {
    await emitNotification(booking.business_id, 'booking_created', booking.id, supabase);
    console.log('✅ Notification triggered!\n');
    
    // Wait a moment for job to be created
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check new job
    const { data: newJobs } = await supabase
      .from('notification_jobs')
      .select('*')
      .eq('booking_id', booking.id)
      .eq('channel', 'sms')
      .eq('trigger', 'booking_created')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (newJobs && newJobs.length > 0) {
      const smsJob = newJobs[0];
      console.log('✅ New SMS job created!');
      console.log(`   Job ID: ${smsJob.id.substring(0, 8)}...`);
      console.log(`   To: ${smsJob.recipient_phone}`);
      console.log(`   Status: ${smsJob.status}\n`);
      
      if (smsJob.status === 'pending') {
        console.log('⏳ Processing SMS job...');
        const response = await fetch('http://localhost:3000/api/cron/notifications', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${process.env.CRON_SECRET || '8083fa6c-4a5b-4c5d-6e7f-8a9b0c1d2e3f'}`,
          },
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('✅ Cron job executed:', result);
          
          // Check status again
          await new Promise(resolve => setTimeout(resolve, 500));
          const { data: updatedJob } = await supabase
            .from('notification_jobs')
            .select('*')
            .eq('id', smsJob.id)
            .single();
          
          if (updatedJob) {
            console.log(`\n📱 SMS Status: ${updatedJob.status}`);
            if (updatedJob.status === 'sent') {
              console.log('✅ SMS sent successfully!');
              console.log(`   To: ${updatedJob.recipient_phone}`);
              console.log('   Check your phone for the message!');
            } else if (updatedJob.status === 'failed') {
              console.log(`❌ SMS failed: ${updatedJob.last_error}`);
            }
          }
        }
      }
    } else {
      console.log('⚠️  No SMS job was created.');
      console.log('   Possible reasons:');
      console.log('   - Customer has no phone number');
      console.log('   - SMS template not enabled');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

const bookingId = process.argv[2];
retrySMSCorrectPhone(bookingId)
  .then(() => {
    console.log('\n✅ Complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

