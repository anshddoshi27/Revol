/**
 * Check detailed carrier information for phone number
 * 
 * Usage:
 *   npx tsx apps/web/src/lib/__tests__/check-carrier-details.ts +19087237864
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

async function checkCarrierDetails(phoneNumber: string) {
  console.log('🔍 Checking carrier details...\n');
  
  const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
  
  if (!twilioAccountSid || !twilioAuthToken) {
    console.error('❌ Twilio credentials not configured');
    process.exit(1);
  }
  
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
  
  console.log(`📞 Phone Number: ${formattedPhone}\n`);
  
  const credentials = `${twilioAccountSid}:${twilioAuthToken}`;
  const base64Credentials = btoa(credentials);
  
  // Try different lookup types
  const lookupTypes = [
    { name: 'Carrier', type: 'carrier' },
    { name: 'Caller Name', type: 'caller-name' },
  ];
  
  for (const lookupType of lookupTypes) {
    console.log(`📊 ${lookupType.name} Lookup:`);
    try {
      const lookupUrl = `https://lookups.twilio.com/v1/PhoneNumbers/${formattedPhone}?Type=${lookupType.type}`;
      const lookupResponse = await fetch(lookupUrl, {
        headers: {
          'Authorization': `Basic ${base64Credentials}`,
        },
      });
      
      if (lookupResponse.ok) {
        const lookupData = await lookupResponse.json();
        console.log(`   ✅ Lookup successful`);
        console.log(`   Phone Number: ${lookupData.phone_number}`);
        console.log(`   Country Code: ${lookupData.country_code}`);
        console.log(`   National Format: ${lookupData.national_format || 'N/A'}`);
        
        if (lookupData.carrier) {
          console.log(`   Carrier Name: ${lookupData.carrier.name || 'Unknown'}`);
          console.log(`   Carrier Type: ${lookupData.carrier.type || 'Unknown'}`);
          console.log(`   Mobile Network Code: ${lookupData.carrier.mobile_network_code || 'N/A'}`);
        }
        
        if (lookupData.caller_name) {
          console.log(`   Caller Name: ${lookupData.caller_name.caller_name || 'N/A'}`);
          console.log(`   Caller Type: ${lookupData.caller_name.caller_type || 'N/A'}`);
        }
        
        // Check if it's a mobile number
        if (lookupData.carrier?.type) {
          if (lookupData.carrier.type === 'mobile') {
            console.log(`   ✅ This is a mobile number - SMS should work`);
          } else if (lookupData.carrier.type === 'landline') {
            console.log(`   ⚠️  This is a landline - SMS will NOT work!`);
            console.log(`   💡 Error 30032 often occurs when sending SMS to landlines`);
          } else {
            console.log(`   ⚠️  Carrier type is ${lookupData.carrier.type} - may not support SMS`);
          }
        }
      } else {
        const errorText = await lookupResponse.text();
        console.log(`   ❌ Lookup failed: ${lookupResponse.status}`);
        try {
          const errorData = JSON.parse(errorText);
          console.log(`   Error: ${errorData.message || 'Unknown'}`);
        } catch {
          console.log(`   ${errorText}`);
        }
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error}`);
    }
    console.log('');
  }
  
  // Check recent failed messages for this number
  console.log(`📨 Checking recent message history...`);
  try {
    const messagesUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json?To=${encodeURIComponent(formattedPhone)}&PageSize=5`;
    const messagesResponse = await fetch(messagesUrl, {
      headers: {
        'Authorization': `Basic ${base64Credentials}`,
      },
    });
    
    if (messagesResponse.ok) {
      const messagesData = await messagesResponse.json();
      const messages = messagesData.messages || [];
      
      if (messages.length > 0) {
        console.log(`   Found ${messages.length} recent message(s):\n`);
        for (const msg of messages.slice(0, 3)) {
          console.log(`   📨 ${msg.sid}:`);
          console.log(`      Status: ${msg.status}`);
          console.log(`      Date: ${msg.date_sent || msg.date_created}`);
          if (msg.error_code) {
            console.log(`      Error: ${msg.error_code} - ${msg.error_message || 'None'}`);
          }
          console.log('');
        }
      } else {
        console.log(`   No messages found`);
      }
    }
  } catch (error) {
    console.log(`   ⚠️  Could not fetch message history: ${error}`);
  }
  
  console.log(`\n💡 Troubleshooting Error 30032:`);
  console.log(`   1. If carrier type is "landline" → SMS won't work, need mobile number`);
  console.log(`   2. If carrier is "Unknown" → May be a VoIP number that doesn't support SMS`);
  console.log(`   3. Check if phone is on and has signal`);
  console.log(`   4. Some carriers block trial account messages`);
  console.log(`   5. Try sending a test SMS from another service to verify your number works`);
}

const phoneNumber = process.argv[2] || '+19087237864';
checkCarrierDetails(phoneNumber)
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

