/**
 * Live Notification System Test
 * 
 * This script tests the actual notification system with real API calls.
 * 
 * Usage:
 *   npx tsx apps/web/src/lib/__tests__/test-notifications-live.ts
 * 
 * Requirements:
 *   - Valid SendGrid API key
 *   - Verified SendGrid sender identity
 *   - Valid Twilio credentials
 *   - Real phone number for testing (verified if on trial account)
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const currentDir = dirname(__filename);
const envPath = resolve(currentDir, '../../../.env');
const envLocalPath = resolve(currentDir, '../../../.env.local');
config({ path: envPath });
config({ path: envLocalPath, override: false });

import { emitNotification } from '../notifications';
import { createAdminClient } from '../db';

// Test configuration
const TEST_EMAIL = process.env.TEST_EMAIL || 'test@example.com';
const TEST_PHONE = process.env.TEST_PHONE;

async function testNotificationSystem() {
  console.log('🧪 Testing Live Notification System\n');
  
  // Check prerequisites
  if (!process.env.SENDGRID_API_KEY) {
    console.error('❌ SENDGRID_API_KEY not set');
    process.exit(1);
  }
  
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.error('❌ Twilio credentials not set');
    process.exit(1);
  }
  
  if (!TEST_PHONE) {
    console.error('❌ TEST_PHONE not set in .env file');
    console.error('   Add: TEST_PHONE=+1234567890 (your real phone number)');
    process.exit(1);
  }
  
  console.log('📋 Test Configuration:');
  console.log(`   Test Email: ${TEST_EMAIL}`);
  console.log(`   Test Phone: ${TEST_PHONE}`);
  console.log(`   SendGrid From: ${process.env.SENDGRID_FROM_EMAIL || 'noreply@revol.com'}`);
  console.log(`   Twilio From: ${process.env.TWILIO_FROM_NUMBER}`);
  console.log('');
  
  // Get a test business ID
  const supabase = createAdminClient();
  const { data: businesses, error: businessError } = await supabase
    .from('businesses')
    .select('id, name, user_id, notifications_enabled')
    .limit(1);
  
  if (businessError || !businesses || businesses.length === 0) {
    console.error('❌ No businesses found in database');
    console.error('   Create a business first through onboarding');
    process.exit(1);
  }
  
  const business = businesses[0];
  console.log(`📦 Using Business: ${business.name} (${business.id})`);
  console.log(`   Notifications Enabled: ${business.notifications_enabled ? 'Yes (Pro Plan)' : 'No (Basic Plan)'}`);
  console.log('');
  
  if (!business.notifications_enabled) {
    console.log('⚠️  Business is on Basic Plan - notifications are disabled');
    console.log('   To test notifications, the business needs to be on Pro Plan');
    console.log('   Update notifications_enabled to true in the database, or');
    console.log('   Complete onboarding with Pro Plan selected');
    process.exit(1);
  }
  
  // Create a test booking
  console.log('📝 Creating test booking...');
  
  // Get service and staff
  const { data: services } = await supabase
    .from('services')
    .select('id, name, duration_min, price_cents')
    .eq('business_id', business.id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .limit(1);
  
  if (!services || services.length === 0) {
    console.error('❌ No services found for this business');
    console.error('   Add services through the admin panel first');
    process.exit(1);
  }
  
  const service = services[0];
  
  // Get staff for this service
  const { data: staff } = await supabase
    .from('staff')
    .select('id, name')
    .eq('business_id', business.id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .limit(1);
  
  if (!staff || staff.length === 0) {
    console.error('❌ No staff found for this business');
    console.error('   Add staff through the admin panel first');
    process.exit(1);
  }
  
  const staffMember = staff[0];
  
  // Create or get customer
  console.log('   Creating/getting customer...');
  const { data: existingCustomer } = await supabase
    .from('customers')
    .select('id')
    .eq('business_id', business.id)
    .eq('email', TEST_EMAIL.toLowerCase().trim())
    .single();
  
  let customerId: string;
  if (existingCustomer) {
    customerId = existingCustomer.id;
    // Update customer info
    await supabase
      .from('customers')
      .update({
        name: 'Test Customer',
        phone: TEST_PHONE || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', customerId);
  } else {
    const { data: newCustomer, error: customerError } = await supabase
      .from('customers')
      .insert({
        user_id: business.user_id,
        business_id: business.id,
        name: 'Test Customer',
        email: TEST_EMAIL.toLowerCase().trim(),
        phone: TEST_PHONE || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    
    if (customerError || !newCustomer) {
      console.error('❌ Failed to create customer:', customerError);
      process.exit(1);
    }
    
    customerId = newCustomer.id;
  }
  
  // Calculate booking times
  const startAt = new Date();
  startAt.setHours(startAt.getHours() + 24); // 24 hours from now
  const endAt = new Date(startAt.getTime() + service.duration_min * 60 * 1000);
  
  // Create booking
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert({
      user_id: business.user_id,
      business_id: business.id,
      customer_id: customerId,
      service_id: service.id,
      staff_id: staffMember.id,
      status: 'pending',
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      duration_min: service.duration_min,
      price_cents: service.price_cents,
      final_price_cents: service.price_cents,
      source: 'admin',
      policy_snapshot: {},
      payment_status: 'card_saved',
      last_money_action: 'none',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (bookingError || !booking) {
    console.error('❌ Failed to create test booking:', bookingError);
    process.exit(1);
  }
  
  console.log(`✅ Created test booking: ${booking.id}`);
  console.log(`   Service: ${service.name}`);
  console.log(`   Staff: ${staffMember.name}`);
  console.log(`   Customer: Test Customer (${TEST_EMAIL})`);
  console.log(`   Date: ${startAt.toLocaleString()}`);
  console.log(`   Duration: ${service.duration_min} minutes`);
  console.log('');
  
  // Test notification
  console.log('📤 Triggering booking_created notification...');
  try {
    await emitNotification(
      business.id,
      'booking_created',
      booking.id
    );
    console.log('✅ Notification triggered successfully');
    console.log('');
    console.log('📬 Check your:');
    console.log(`   📧 Email: ${TEST_EMAIL}`);
    console.log(`   📱 SMS: ${TEST_PHONE}`);
    console.log('');
    console.log('⏳ Note: Notifications are queued and processed by cron job');
    console.log('   Check notification_jobs table in database for status');
  } catch (error) {
    console.error('❌ Failed to trigger notification:', error);
    process.exit(1);
  }
  
  // Check if notification job was created (before cleanup)
  console.log('🔍 Checking if notification job was created...');
  const { data: notificationJobs } = await supabase
    .from('notification_jobs')
    .select('id, trigger, channel, status, recipient_email, recipient_phone, created_at')
    .eq('booking_id', booking.id)
    .order('created_at', { ascending: false });
  
  if (notificationJobs && notificationJobs.length > 0) {
    console.log(`✅ Found ${notificationJobs.length} notification job(s):`);
    notificationJobs.forEach((job, index) => {
      console.log(`   ${index + 1}. ${job.trigger} (${job.channel}) - Status: ${job.status}`);
      console.log(`      To: ${job.recipient_email || job.recipient_phone || 'N/A'}`);
    });
    console.log('');
    console.log('⚠️  Note: Keeping booking and notification jobs for testing');
    console.log('   You can manually delete them later or they will be cleaned up by the cron job');
  } else {
    console.log('⚠️  No notification jobs found for this booking');
    console.log('   This could mean:');
    console.log('   - No templates are configured for booking_created trigger');
    console.log('   - Templates are disabled');
    console.log('   - Notification creation failed');
  }
  
  // Don't delete the booking - keep it for testing notification processing
  // The notification job will be deleted if booking is deleted (CASCADE)
  console.log('');
  console.log('✅ Test complete');
  console.log(`   Booking ID: ${booking.id}`);
  console.log('   You can check notification jobs with:');
  console.log('   npx tsx apps/web/src/lib/__tests__/check-recent-jobs.ts');
}

testNotificationSystem()
  .then(() => {
    console.log('\n✅ All tests completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });

