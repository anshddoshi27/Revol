/**
 * Test SMS sending directly with detailed error checking
 * 
 * Usage:
 *   npx tsx apps/web/src/lib/__tests__/test-sms-direct-detailed.ts +19087237864
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

async function testSMSDetailed(phoneNumber: string) {
  console.log('📱 Testing SMS with detailed diagnostics...\n');
  
  const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFromNumber = process.env.TWILIO_FROM_NUMBER;
  
  if (!twilioAccountSid || !twilioAuthToken || !twilioFromNumber) {
    console.error('❌ Twilio credentials not configured');
    process.exit(1);
  }
  
  console.log(`📋 Configuration:`);
  console.log(`   To: ${phoneNumber}`);
  console.log(`   From: ${twilioFromNumber}`);
  console.log(`   Account: ${twilioAccountSid.substring(0, 8)}...\n`);
  
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
  
  // Try different message formats to see if any work
  const testMessages = [
    {
      name: 'Simple test',
      body: 'Test message from Revol'
    },
    {
      name: 'Without trial prefix hint',
      body: 'Hi! This is a test message. Reply STOP to opt out.'
    },
    {
      name: 'Short message',
      body: 'Test'
    }
  ];
  
  for (const testMsg of testMessages) {
    console.log(`\n📤 Testing: ${testMsg.name}`);
    console.log(`   Message: "${testMsg.body}"`);
    
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
      const formData = new URLSearchParams();
      formData.append('From', twilioFromNumber);
      formData.append('To', formattedPhone);
      formData.append('Body', testMsg.body);
      
      const credentials = `${twilioAccountSid}:${twilioAuthToken}`;
      const base64Credentials = btoa(credentials);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${base64Credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });
      
      const responseText = await response.text();
      
      if (response.ok) {
        const data = JSON.parse(responseText);
        console.log(`   ✅ Message sent!`);
        console.log(`   Message SID: ${data.sid}`);
        console.log(`   Status: ${data.status}`);
        console.log(`   Price: ${data.price || 'N/A'}`);
        
        // Wait a moment and check status
        console.log(`   ⏳ Waiting 3 seconds to check delivery status...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Check message status
        const statusUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages/${data.sid}.json`;
        const statusResponse = await fetch(statusUrl, {
          headers: {
            'Authorization': `Basic ${base64Credentials}`,
          },
        });
        
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          console.log(`   📊 Updated Status: ${statusData.status}`);
          if (statusData.error_code) {
            console.log(`   ❌ Error Code: ${statusData.error_code}`);
            console.log(`   ❌ Error Message: ${statusData.error_message || 'None'}`);
          }
          if (statusData.status === 'delivered') {
            console.log(`   🎉 Message delivered!`);
            break; // Success, no need to try other formats
          } else if (statusData.status === 'sent') {
            console.log(`   ⏳ Sent to carrier, delivery pending...`);
          } else if (statusData.status === 'undelivered' || statusData.status === 'failed') {
            console.log(`   ❌ Delivery failed`);
            if (statusData.error_code === 30032) {
              console.log(`   💡 Error 30032: Carrier couldn't deliver to handset`);
              console.log(`      Possible causes:`);
              console.log(`      - Phone is off or out of coverage`);
              console.log(`      - Carrier is blocking the message`);
              console.log(`      - Phone number is not reachable`);
            }
          }
        }
      } else {
        const errorData = JSON.parse(responseText);
        console.log(`   ❌ Failed to send`);
        console.log(`   Error: ${errorData.message || 'Unknown error'}`);
        console.log(`   Code: ${errorData.code || 'N/A'}`);
      }
    } catch (error) {
      console.error(`   ❌ Error:`, error);
    }
  }
  
  // Also check if the number is reachable via Twilio Lookup API
  console.log(`\n🔍 Checking phone number validity...`);
  try {
    const lookupUrl = `https://lookups.twilio.com/v1/PhoneNumbers/${formattedPhone}?Type=carrier`;
    const credentials = `${twilioAccountSid}:${twilioAuthToken}`;
    const base64Credentials = btoa(credentials);
    
    const lookupResponse = await fetch(lookupUrl, {
      headers: {
        'Authorization': `Basic ${base64Credentials}`,
      },
    });
    
    if (lookupResponse.ok) {
      const lookupData = await lookupResponse.json();
      console.log(`   ✅ Number is valid`);
      console.log(`   Carrier: ${lookupData.carrier?.name || 'Unknown'}`);
      console.log(`   Type: ${lookupData.carrier?.type || 'Unknown'}`);
      console.log(`   Country: ${lookupData.country_code || 'Unknown'}`);
    } else {
      const errorText = await lookupResponse.text();
      console.log(`   ⚠️  Could not lookup number: ${lookupResponse.status}`);
      console.log(`   ${errorText}`);
    }
  } catch (error) {
    console.log(`   ⚠️  Lookup failed: ${error}`);
  }
  
  console.log(`\n💡 Tips for trial accounts:`);
  console.log(`   1. Make sure your phone is on and has signal`);
  console.log(`   2. Check if your carrier blocks trial account messages`);
  console.log(`   3. Try sending from a different device/network`);
  console.log(`   4. Check Twilio console for detailed error messages`);
  console.log(`   5. Some carriers require messages to be from a paid account`);
}

const phoneNumber = process.argv[2] || '9087237864';
testSMSDetailed(phoneNumber)
  .then(() => {
    console.log('\n✅ Test complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

