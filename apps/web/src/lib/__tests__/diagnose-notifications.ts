/**
 * Diagnose why notifications aren't being sent
 * 
 * Usage:
 *   npx tsx apps/web/src/lib/__tests__/diagnose-notifications.ts [businessId]
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

async function diagnoseNotifications(businessId?: string) {
  console.log('🔍 Diagnosing notification system...\n');
  
  const supabase = createAdminClient();
  
  // Get business
  let business;
  if (businessId) {
    const { data, error } = await supabase
      .from('businesses')
      .select('id, name, notifications_enabled, user_id')
      .eq('id', businessId)
      .single();
    
    if (error || !data) {
      console.error(`❌ Business ${businessId} not found`);
      process.exit(1);
    }
    business = data;
  } else {
    // Get most recent Pro Plan business
    const { data, error } = await supabase
      .from('businesses')
      .select('id, name, notifications_enabled, user_id')
      .eq('notifications_enabled', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error || !data) {
      console.error('❌ No Pro Plan business found');
      process.exit(1);
    }
    business = data;
  }
  
  console.log(`📦 Business: ${business.name} (${business.id})`);
  console.log(`   Notifications Enabled: ${business.notifications_enabled ? '✅ Yes' : '❌ No'}`);
  console.log(`   User ID: ${business.user_id}\n`);
  
  if (!business.notifications_enabled) {
    console.log('❌ Notifications are disabled for this business (Basic Plan)');
    console.log('   Solution: Enable notifications in onboarding Step 8\n');
    return;
  }
  
  // Check templates
  console.log('📋 Checking templates...');
  const { data: templates, error: templatesError } = await supabase
    .from('notification_templates')
    .select('*')
    .eq('business_id', business.id)
    .eq('user_id', business.user_id)
    .is('deleted_at', null);
  
  if (templatesError) {
    console.error('❌ Error fetching templates:', templatesError);
    return;
  }
  
  if (!templates || templates.length === 0) {
    console.log('❌ No templates found!');
    console.log('   Solution: Create templates in onboarding Step 8 or admin notifications page\n');
    return;
  }
  
  console.log(`   Found ${templates.length} template(s)`);
  
  // Check for booking_created templates
  const bookingCreatedTemplates = templates.filter(t => 
    t.trigger === 'booking_created'
  );
  
  console.log(`   booking_created templates: ${bookingCreatedTemplates.length}`);
  
  const enabledBookingCreated = bookingCreatedTemplates.filter(t => t.is_enabled);
  console.log(`   Enabled booking_created templates: ${enabledBookingCreated.length}`);
  
  if (enabledBookingCreated.length === 0) {
    console.log('\n❌ No enabled "booking_created" templates found!');
    console.log('   This is why notifications aren\'t being created.');
    console.log('\n💡 Solution:');
    console.log('   1. Go to admin notifications page');
    console.log('   2. Enable at least one template with trigger = "booking_created"');
    console.log('   3. Make sure it\'s configured for email or SMS\n');
    return;
  }
  
  enabledBookingCreated.forEach((t, i) => {
    console.log(`\n   Template ${i + 1}: ${t.name || 'Unnamed'}`);
    console.log(`     Channel: ${t.channel}`);
    console.log(`     Enabled: ${t.is_enabled ? '✅' : '❌'}`);
  });
  
  // Check recent bookings
  console.log('\n📅 Checking recent bookings...');
  const fiveMinutesAgo = new Date();
  fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);
  
  const { data: recentBookings, error: bookingsError } = await supabase
    .from('bookings')
    .select('id, customer_id, created_at')
    .eq('business_id', business.id)
    .gte('created_at', fiveMinutesAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (bookingsError) {
    console.error('❌ Error fetching bookings:', bookingsError);
    return;
  }
  
  if (!recentBookings || recentBookings.length === 0) {
    console.log('   No bookings in last 5 minutes');
    console.log('   (This is normal if you just created a booking more than 5 minutes ago)');
  } else {
    console.log(`   Found ${recentBookings.length} booking(s) in last 5 minutes`);
  }
  
  // Check notification jobs
  console.log('\n📬 Checking notification jobs...');
  const { data: jobs, error: jobsError } = await supabase
    .from('notification_jobs')
    .select('*')
    .eq('business_id', business.id)
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (jobsError) {
    console.error('❌ Error fetching jobs:', jobsError);
    return;
  }
  
  if (!jobs || jobs.length === 0) {
    console.log('❌ No notification jobs found!');
    console.log('   This means emitNotification() was not called or failed silently.');
    console.log('\n💡 Possible causes:');
    console.log('   - Templates exist but emitNotification() was not called after booking');
    console.log('   - emitNotification() failed silently (check server logs)');
    console.log('   - Booking was created before templates were set up\n');
    return;
  }
  
  console.log(`   Found ${jobs.length} job(s) total`);
  
  const recentJobs = jobs.filter(j => {
    const created = new Date(j.created_at);
    return created >= fiveMinutesAgo;
  });
  
  console.log(`   Recent jobs (last 5 min): ${recentJobs.length}`);
  
  if (recentJobs.length > 0) {
    console.log('\n   Recent job details:');
    recentJobs.forEach((job, i) => {
      console.log(`\n   ${i + 1}. Job ID: ${job.id.substring(0, 8)}...`);
      console.log(`      Trigger: ${job.trigger}`);
      console.log(`      Channel: ${job.channel}`);
      console.log(`      Status: ${job.status}`);
      console.log(`      To: ${job.recipient_email || job.recipient_phone || 'N/A'}`);
      if (job.last_error) {
        console.log(`      ❌ Error: ${job.last_error}`);
      }
      if (job.status === 'pending') {
        console.log(`      ⏳ Pending - needs cron job to process`);
      }
      if (job.status === 'sent') {
        console.log(`      ✅ Sent successfully`);
      }
    });
    
    const pendingJobs = recentJobs.filter(j => j.status === 'pending');
    if (pendingJobs.length > 0) {
      console.log(`\n   ⚠️  ${pendingJobs.length} job(s) are pending`);
      console.log('   Solution: Run the cron job to process them:');
      console.log('   npx tsx apps/web/src/lib/__tests__/process-notifications.ts');
    }
  }
  
  // Summary
  console.log('\n📊 Summary:');
  console.log(`   ✅ Business has notifications enabled`);
  console.log(`   ${enabledBookingCreated.length > 0 ? '✅' : '❌'} Enabled templates exist`);
  console.log(`   ${jobs && jobs.length > 0 ? '✅' : '❌'} Notification jobs exist`);
  console.log(`   ${recentJobs && recentJobs.length > 0 ? '✅' : '❌'} Recent jobs found`);
  
  if (recentJobs && recentJobs.length > 0) {
    const sent = recentJobs.filter(j => j.status === 'sent').length;
    const pending = recentJobs.filter(j => j.status === 'pending').length;
    const failed = recentJobs.filter(j => j.status === 'failed').length;
    
    console.log(`\n   Job Status: ${sent} sent, ${pending} pending, ${failed} failed`);
    
    if (pending > 0) {
      console.log('\n💡 Next step: Process pending jobs');
      console.log('   npx tsx apps/web/src/lib/__tests__/process-notifications.ts');
    }
    
    if (failed > 0) {
      console.log('\n⚠️  Some jobs failed. Check errors above.');
    }
  }
}

const businessId = process.argv[2];
diagnoseNotifications(businessId)
  .then(() => {
    console.log('\n✅ Diagnosis complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

