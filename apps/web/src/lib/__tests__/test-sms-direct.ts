/**
 * Test SMS sending directly to verify phone number format
 * 
 * Usage:
 *   npx tsx apps/web/src/lib/__tests__/test-sms-direct.ts +19087237864
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

import { sendSMSViaTwilio } from '../notification-senders';

async function testSMS(phoneNumber: string) {
  console.log('📱 Testing SMS sending...\n');
  
  console.log(`📋 Configuration:`);
  console.log(`   To: ${phoneNumber}`);
  console.log(`   From: ${process.env.TWILIO_FROM_NUMBER || 'Not set'}\n`);
  
  // Format phone number
  const digits = phoneNumber.replace(/\D/g, '');
  let formattedPhone: string;
  
  if (digits.length === 11 && digits.startsWith('1')) {
    formattedPhone = `+${digits}`;
  } else if (digits.length === 10) {
    formattedPhone = `+1${digits}`;
  } else if (phoneNumber.startsWith('+')) {
    formattedPhone = phoneNumber;
  } else {
    formattedPhone = `+1${digits.slice(-10)}`;
  }
  
  console.log(`📞 Formatted phone: ${formattedPhone}\n`);
  
  const testMessage = `Test SMS from Revol - ${new Date().toLocaleString()}`;
  
  console.log('📤 Sending SMS...');
  const result = await sendSMSViaTwilio(formattedPhone, testMessage);
  
  if (result.success) {
    console.log('✅ SMS sent successfully!');
    console.log(`   Message ID: ${result.messageId}`);
    console.log(`\n💡 Check your phone for the message.`);
    console.log(`   If you don't receive it:`);
    console.log(`   1. Check if your Twilio account is a trial account`);
    console.log(`   2. Verify the number in Twilio Console:`);
    console.log(`      https://console.twilio.com/us1/develop/phone-numbers/manage/verified`);
    console.log(`   3. Trial accounts can only send to verified numbers`);
  } else {
    console.log('❌ SMS failed!');
    console.log(`   Error: ${result.error}`);
    console.log(`\n💡 Common issues:`);
    console.log(`   - Twilio trial account: Can only send to verified numbers`);
    console.log(`   - Invalid phone number format`);
    console.log(`   - Phone number not verified in Twilio Console`);
  }
}

const phoneNumber = process.argv[2] || '9087237864';
testSMS(phoneNumber)
  .then(() => {
    console.log('\n✅ Test complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

