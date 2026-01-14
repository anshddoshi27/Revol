/**
 * Check notification setup for a specific booking
 * 
 * Usage:
 *   npx tsx apps/web/src/lib/__tests__/check-booking-notifications.ts [bookingId]
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

async function checkBookingNotifications(bookingId?: string) {
  console.log('🔍 Checking booking notification setup...\n');
  
  const supabase = createAdminClient();
  
  // Get most recent booking if not specified
  let booking;
  if (bookingId) {
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        id,
        business_id,
        customer_id,
        businesses:business_id (
          id,
          name,
          notifications_enabled,
          user_id
        ),
        customers:customer_id (
          id,
          name,
          email,
          phone
        )
      `)
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
      .select(`
        id,
        business_id,
        customer_id,
        businesses:business_id (
          id,
          name,
          notifications_enabled,
          user_id
        ),
        customers:customer_id (
          id,
          name,
          email,
          phone
        )
      `)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error || !data) {
      console.error('❌ No bookings found');
      process.exit(1);
    }
    booking = data;
  }
  
  const business = booking.businesses;
  const customer = booking.customers;
  
  console.log(`📦 Business: ${business.name} (${business.id})`);
  console.log(`   Notifications Enabled: ${business.notifications_enabled ? '✅ Yes' : '❌ No'}\n`);
  
  console.log(`👤 Customer: ${customer.name || 'N/A'}`);
  console.log(`   Email: ${customer.email || '❌ Missing'}`);
  console.log(`   Phone: ${customer.phone || '❌ Missing'}\n`);
  
  if (!business.notifications_enabled) {
    console.log('❌ Notifications are disabled for this business');
    return;
  }
  
  // Check templates
  console.log('📋 Checking templates...');
  const { data: templates, error: templatesError } = await supabase
    .from('notification_templates')
    .select('*')
    .eq('business_id', business.id)
    .eq('user_id', business.user_id)
    .eq('trigger', 'booking_created')
    .is('deleted_at', null);
  
  if (templatesError) {
    console.error('❌ Error fetching templates:', templatesError);
    return;
  }
  
  if (!templates || templates.length === 0) {
    console.log('❌ No booking_created templates found!');
    return;
  }
  
  const emailTemplate = templates.find(t => t.channel === 'email' && t.is_enabled);
  const smsTemplate = templates.find(t => t.channel === 'sms' && t.is_enabled);
  
  console.log(`   Email template: ${emailTemplate ? '✅ Enabled' : '❌ Missing/Disabled'}`);
  console.log(`   SMS template: ${smsTemplate ? '✅ Enabled' : '❌ Missing/Disabled'}\n`);
  
  // Check notification jobs
  console.log('📬 Checking notification jobs for this booking...');
  const { data: jobs, error: jobsError } = await supabase
    .from('notification_jobs')
    .select('*')
    .eq('booking_id', booking.id)
    .order('created_at', { ascending: false });
  
  if (jobsError) {
    console.error('❌ Error fetching jobs:', jobsError);
    return;
  }
  
  if (!jobs || jobs.length === 0) {
    console.log('❌ No notification jobs found for this booking!');
    console.log('   This means emitNotification() was not called or failed.\n');
    return;
  }
  
  console.log(`   Found ${jobs.length} job(s):\n`);
  
  jobs.forEach((job, i) => {
    console.log(`   ${i + 1}. ${job.channel.toUpperCase()} - ${job.status}`);
    console.log(`      To: ${job.recipient_email || job.recipient_phone || 'N/A'}`);
    if (job.last_error) {
      console.log(`      ❌ Error: ${job.last_error}`);
    }
    console.log('');
  });
  
  // Diagnosis
  console.log('🔍 Diagnosis:\n');
  
  if (!customer.phone) {
    console.log('❌ Customer has no phone number!');
    console.log('   SMS cannot be sent without a phone number.');
    console.log('   Solution: Make sure customer enters phone number during booking.\n');
  } else if (!smsTemplate) {
    console.log('❌ No SMS template enabled!');
    console.log('   Solution: Enable SMS template in admin notifications page.\n');
  } else {
    const smsJob = jobs.find(j => j.channel === 'sms');
    if (!smsJob) {
      console.log('❌ No SMS job was created!');
      console.log('   This means emitNotification() did not create an SMS job.');
      console.log('   Possible causes:');
      console.log('   - Customer phone number format issue');
      console.log('   - SMS template not found during emitNotification()\n');
    } else {
      console.log(`✅ SMS job exists: ${smsJob.status}`);
      if (smsJob.status === 'pending') {
        console.log('   ⏳ Job is pending - needs to be processed\n');
      } else if (smsJob.status === 'sent') {
        console.log('   ✅ SMS was sent successfully\n');
      } else if (smsJob.status === 'failed') {
        console.log(`   ❌ SMS failed: ${smsJob.last_error}\n`);
      }
    }
  }
}

const bookingId = process.argv[2];
checkBookingNotifications(bookingId)
  .then(() => {
    console.log('✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

