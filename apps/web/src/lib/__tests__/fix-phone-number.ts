/**
 * Fix phone number for a customer/booking
 * 
 * Usage:
 *   npx tsx apps/web/src/lib/__tests__/fix-phone-number.ts [customerId] [phoneNumber]
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

function formatPhoneNumber(phone: string): string {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  
  // If it starts with 1 and has 11 digits, it's already US format
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  
  // If it has 10 digits, add +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  
  // If it already starts with +, return as-is (but validate)
  if (phone.startsWith('+')) {
    return phone;
  }
  
  // Otherwise, try to format
  return `+${digits}`;
}

async function fixPhoneNumber(customerId?: string, phoneNumber?: string) {
  console.log('🔧 Fixing phone number...\n');
  
  const supabase = createAdminClient();
  
  // Get most recent customer if not specified
  let customer;
  if (customerId) {
    const { data, error } = await supabase
      .from('customers')
      .select('id, name, email, phone')
      .eq('id', customerId)
      .single();
    
    if (error || !data) {
      console.error(`❌ Customer ${customerId} not found`);
      process.exit(1);
    }
    customer = data;
  } else {
    const { data, error } = await supabase
      .from('customers')
      .select('id, name, email, phone')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error || !data) {
      console.error('❌ No customers found');
      process.exit(1);
    }
    customer = data;
  }
  
  console.log(`👤 Customer: ${customer.name}`);
  console.log(`   Current Phone: ${customer.phone || 'N/A'}\n`);
  
  let newPhone: string;
  if (phoneNumber) {
    newPhone = formatPhoneNumber(phoneNumber);
    console.log(`📱 Formatting provided number: ${phoneNumber} → ${newPhone}`);
  } else if (customer.phone) {
    // Try to fix the existing phone number
    const digits = customer.phone.replace(/\D/g, '');
    if (digits.length === 10) {
      newPhone = `+1${digits}`;
      console.log(`📱 Fixing existing number: ${customer.phone} → ${newPhone}`);
    } else if (digits.length === 11 && digits.startsWith('1')) {
      newPhone = `+${digits}`;
      console.log(`📱 Fixing existing number: ${customer.phone} → ${newPhone}`);
    } else {
      console.log(`❌ Cannot auto-fix phone number: ${customer.phone}`);
      console.log(`   Please provide the correct phone number as argument`);
      console.log(`   Usage: npx tsx apps/web/src/lib/__tests__/fix-phone-number.ts ${customer.id} 9087237864`);
      process.exit(1);
    }
  } else {
    console.log('❌ Customer has no phone number');
    if (!phoneNumber) {
      console.log('   Please provide a phone number as argument');
      console.log(`   Usage: npx tsx apps/web/src/lib/__tests__/fix-phone-number.ts ${customer.id} 9087237864`);
      process.exit(1);
    }
    newPhone = formatPhoneNumber(phoneNumber);
  }
  
  console.log(`\n💾 Updating customer phone number...`);
  const { error: updateError } = await supabase
    .from('customers')
    .update({
      phone: newPhone,
      updated_at: new Date().toISOString(),
    })
    .eq('id', customer.id);
  
  if (updateError) {
    console.error('❌ Error updating phone number:', updateError);
    process.exit(1);
  }
  
  console.log(`✅ Phone number updated: ${newPhone}\n`);
  
  // Check for pending SMS jobs and update them
  console.log('📬 Checking for pending SMS jobs...');
  const { data: bookings, error: bookingsError } = await supabase
    .from('bookings')
    .select('id')
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (bookingsError) {
    console.error('❌ Error fetching bookings:', bookingsError);
    return;
  }
  
  if (bookings && bookings.length > 0) {
    const bookingIds = bookings.map(b => b.id);
    const { data: smsJobs, error: jobsError } = await supabase
      .from('notification_jobs')
      .select('id, status, recipient_phone')
      .in('booking_id', bookingIds)
      .eq('channel', 'sms')
      .in('status', ['pending', 'failed']);
    
    if (jobsError) {
      console.error('❌ Error fetching jobs:', jobsError);
      return;
    }
    
    if (smsJobs && smsJobs.length > 0) {
      console.log(`   Found ${smsJobs.length} SMS job(s) to update\n`);
      
      for (const job of smsJobs) {
        const { error: jobUpdateError } = await supabase
          .from('notification_jobs')
          .update({
            recipient_phone: newPhone,
            status: 'pending', // Reset to pending if it was failed
            last_error: null,
            attempt_count: 0,
            scheduled_at: new Date().toISOString(),
          })
          .eq('id', job.id);
        
        if (jobUpdateError) {
          console.error(`   ❌ Error updating job ${job.id}:`, jobUpdateError);
        } else {
          console.log(`   ✅ Updated job ${job.id.substring(0, 8)}...`);
        }
      }
      
      console.log('\n💡 Next step: Process the updated jobs');
      console.log('   npx tsx apps/web/src/lib/__tests__/process-notifications.ts');
    } else {
      console.log('   No pending/failed SMS jobs found');
    }
  }
}

const customerId = process.argv[2];
const phoneNumber = process.argv[3];
fixPhoneNumber(customerId, phoneNumber)
  .then(() => {
    console.log('\n✅ Complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

