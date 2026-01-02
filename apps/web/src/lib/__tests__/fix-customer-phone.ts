/**
 * Fix customer phone number and re-trigger SMS
 * 
 * Usage:
 *   npx tsx apps/web/src/lib/__tests__/fix-customer-phone.ts [bookingId]
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

async function fixCustomerPhone(bookingId?: string) {
  console.log('🔧 Fixing customer phone number...\n');
  
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
  
  console.log(`📦 Booking ID: ${booking.id}`);
  console.log(`   Customer ID: ${booking.customer_id}\n`);
  
  // Get customer
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('id, name, email, phone')
    .eq('id', booking.customer_id)
    .single();
  
  if (customerError || !customer) {
    console.error('❌ Customer not found');
    process.exit(1);
  }
  
  console.log(`👤 Customer: ${customer.name}`);
  console.log(`   Current phone: ${customer.phone || 'N/A'}\n`);
  
  // Check if phone is incomplete
  if (customer.phone && customer.phone.length < 12) {
    console.log('⚠️  Phone number appears incomplete!');
    console.log(`   Current: ${customer.phone} (${customer.phone.length} chars)`);
    console.log(`   Expected: +1XXXXXXXXXX (12 chars minimum)\n`);
    
    // Try to fix it - if it's +1908723, we need the full number
    // Since we don't have the original, we'll need to ask or infer
    console.log('💡 Phone number is incomplete. Please provide the full number:');
    console.log('   Format: 9087237864 or +19087237864\n');
    
    // For now, let's check if we can infer from email or other data
    // Actually, the user said they entered 9087237864, so let's use that
    const fullPhone = '+19087237864';
    console.log(`🔧 Updating phone to: ${fullPhone}`);
    
    const { error: updateError } = await supabase
      .from('customers')
      .update({
        phone: fullPhone,
        updated_at: new Date().toISOString(),
      })
      .eq('id', customer.id);
    
    if (updateError) {
      console.error('❌ Error updating phone:', updateError);
      process.exit(1);
    }
    
    console.log('✅ Phone number updated!\n');
    
    // Re-trigger notification
    console.log('🔄 Re-triggering notification with correct phone number...');
    try {
      await emitNotification(booking.business_id, 'booking_created', booking.id, supabase);
      console.log('✅ Notification triggered!\n');
      
      // Process it
      console.log('⏳ Processing notification job...');
      const response = await fetch('http://localhost:3000/api/cron/notifications', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.CRON_SECRET || '8083fa6c-4a5b-4c5d-6e7f-8a9b0c1d2e3f'}`,
        },
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Cron job executed:', result);
        console.log('\n📱 SMS should be sent to: +19087237864');
        console.log('   Check your phone for the message!');
      } else {
        console.log('⚠️  Could not auto-process. Run manually:');
        console.log('   npx tsx apps/web/src/lib/__tests__/process-notifications.ts');
      }
    } catch (error) {
      console.error('❌ Error triggering notification:', error);
    }
  } else {
    console.log('✅ Phone number looks correct!');
    console.log(`   Phone: ${customer.phone}`);
    
    // Check if there's a pending SMS job
    const { data: smsJobs } = await supabase
      .from('notification_jobs')
      .select('*')
      .eq('booking_id', booking.id)
      .eq('channel', 'sms')
      .eq('status', 'pending')
      .limit(1);
    
    if (smsJobs && smsJobs.length > 0) {
      console.log('\n⏳ Found pending SMS job, processing...');
      const response = await fetch('http://localhost:3000/api/cron/notifications', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.CRON_SECRET || '8083fa6c-4a5b-4c5d-6e7f-8a9b0c1d2e3f'}`,
        },
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Cron job executed:', result);
      }
    }
  }
}

const bookingId = process.argv[2];
fixCustomerPhone(bookingId)
  .then(() => {
    console.log('\n✅ Complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

