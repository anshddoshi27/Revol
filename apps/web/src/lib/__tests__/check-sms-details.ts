/**
 * Check detailed SMS job information and Twilio message status
 * 
 * Usage:
 *   npx tsx apps/web/src/lib/__tests__/check-sms-details.ts [jobId]
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

async function checkSMSDetails(jobId?: string) {
  console.log('🔍 Checking SMS job details...\n');
  
  const supabase = createAdminClient();
  
  // Get most recent SMS job if not specified
  let job;
  if (jobId) {
    const { data, error } = await supabase
      .from('notification_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('channel', 'sms')
      .single();
    
    if (error || !data) {
      console.error(`❌ SMS job ${jobId} not found`);
      process.exit(1);
    }
    job = data;
  } else {
    const { data, error } = await supabase
      .from('notification_jobs')
      .select('*')
      .eq('channel', 'sms')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error || !data) {
      console.error('❌ No SMS jobs found');
      process.exit(1);
    }
    job = data;
  }
  
  console.log(`📋 SMS Job Details:`);
  console.log(`   Job ID: ${job.id}`);
  console.log(`   Status: ${job.status}`);
  console.log(`   To: ${job.recipient_phone}`);
  console.log(`   Trigger: ${job.trigger}`);
  console.log(`   Created: ${new Date(job.created_at).toLocaleString()}`);
  console.log(`   Attempts: ${job.attempt_count || 0}`);
  if (job.last_error) {
    console.log(`   Error: ${job.last_error}`);
  }
  console.log(`\n📝 Message Body:`);
  console.log(`   ${job.body?.substring(0, 100)}${job.body?.length > 100 ? '...' : ''}\n`);
  
  // Check Twilio message status if we have a message SID
  // Note: We don't store the Twilio SID in notification_jobs, but we can check notification_events
  const { data: events } = await supabase
    .from('notification_events')
    .select('*')
    .eq('job_id', job.id)
    .order('created_at', { ascending: false })
    .limit(1);
  
  if (events && events.length > 0) {
    const event = events[0];
    console.log(`📊 Notification Event:`);
    console.log(`   Event ID: ${event.id}`);
    console.log(`   Provider Message ID: ${event.provider_message_id || 'N/A'}`);
    console.log(`   Status: ${event.status || 'N/A'}`);
    console.log(`   Created: ${new Date(event.created_at).toLocaleString()}\n`);
    
    // If we have a Twilio SID, check its status via Twilio API
    if (event.provider_message_id && event.provider_message_id.startsWith('SM')) {
      console.log('🔍 Checking Twilio message status...\n');
      
      const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
      const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
      
      if (twilioAccountSid && twilioAuthToken) {
        try {
          const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages/${event.provider_message_id}.json`;
          const credentials = `${twilioAccountSid}:${twilioAuthToken}`;
          const base64Credentials = btoa(credentials);
          
          const response = await fetch(url, {
            headers: {
              'Authorization': `Basic ${base64Credentials}`,
            },
          });
          
          if (response.ok) {
            const message = await response.json();
            console.log('📱 Twilio Message Status:');
            console.log(`   SID: ${message.sid}`);
            console.log(`   Status: ${message.status}`);
            console.log(`   From: ${message.from}`);
            console.log(`   To: ${message.to}`);
            console.log(`   Date Sent: ${message.date_sent || 'Not sent yet'}`);
            console.log(`   Date Created: ${message.date_created}`);
            console.log(`   Error Code: ${message.error_code || 'None'}`);
            console.log(`   Error Message: ${message.error_message || 'None'}`);
            console.log(`   Price: ${message.price || 'N/A'}`);
            console.log(`   Price Unit: ${message.price_unit || 'N/A'}`);
            
            if (message.status === 'delivered') {
              console.log('\n✅ Message was delivered to Twilio and sent to carrier');
            } else if (message.status === 'sent') {
              console.log('\n⏳ Message was sent to carrier, but delivery status is pending');
              console.log('   This is normal - delivery can take a few minutes');
            } else if (message.status === 'queued') {
              console.log('\n⏳ Message is queued for sending');
            } else if (message.status === 'failed') {
              console.log('\n❌ Message failed to send');
              console.log(`   Error Code: ${message.error_code}`);
              console.log(`   Error Message: ${message.error_message}`);
            } else if (message.status === 'undelivered') {
              console.log('\n❌ Message was not delivered');
              console.log(`   Error Code: ${message.error_code}`);
              console.log(`   Error Message: ${message.error_message}`);
            }
          } else {
            const errorText = await response.text();
            console.log(`❌ Failed to fetch Twilio message: ${response.status}`);
            console.log(`   ${errorText}`);
          }
        } catch (error) {
          console.error('❌ Error checking Twilio status:', error);
        }
      }
    }
  } else {
    console.log('⚠️  No notification event found for this job');
    console.log('   This might mean the job was marked as "sent" but no event was recorded');
  }
  
  // Also check the customer record to verify phone number
  if (job.booking_id) {
    const { data: booking } = await supabase
      .from('bookings')
      .select('customer_id')
      .eq('id', job.booking_id)
      .single();
    
    if (booking) {
      const { data: customer } = await supabase
        .from('customers')
        .select('phone, name, email')
        .eq('id', booking.customer_id)
        .single();
      
      if (customer) {
        console.log(`\n👤 Customer Record:`);
        console.log(`   Name: ${customer.name}`);
        console.log(`   Email: ${customer.email}`);
        console.log(`   Phone in DB: ${customer.phone || 'N/A'}`);
        console.log(`   Phone in Job: ${job.recipient_phone || 'N/A'}`);
        
        if (customer.phone !== job.recipient_phone) {
          console.log(`\n⚠️  Phone number mismatch!`);
          console.log(`   Customer DB: ${customer.phone}`);
          console.log(`   Job: ${job.recipient_phone}`);
        }
      }
    }
  }
}

const jobId = process.argv[2];
checkSMSDetails(jobId)
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

