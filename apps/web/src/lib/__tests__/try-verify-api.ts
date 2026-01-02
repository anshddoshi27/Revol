/**
 * Try using Twilio Verify API as an alternative (designed for trial accounts)
 * Note: This is for verification codes, not notifications, but let's see if it works
 * 
 * Usage:
 *   npx tsx apps/web/src/lib/__tests__/try-verify-api.ts +19087237864
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

async function tryVerifyAPI(phoneNumber: string) {
  console.log('🔍 Trying Twilio Verify API (alternative approach)...\n');
  console.log('⚠️  Note: Verify API is for verification codes, not notifications');
  console.log('   But it might work better with trial accounts\n');
  
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
  
  // Try Verify API
  try {
    const verifyUrl = `https://verify.twilio.com/v2/Services`;
    
    // First, check if we have a Verify Service
    const servicesResponse = await fetch(verifyUrl, {
      headers: {
        'Authorization': `Basic ${base64Credentials}`,
      },
    });
    
    if (servicesResponse.ok) {
      const servicesData = await servicesResponse.json();
      const services = servicesData.services || [];
      
      if (services.length > 0) {
        const serviceSid = services[0].sid;
        console.log(`✅ Found Verify Service: ${serviceSid}\n`);
        
        // Try sending a verification code
        console.log(`📤 Sending verification code...`);
        const verifySendUrl = `https://verify.twilio.com/v2/Services/${serviceSid}/Verifications`;
        const formData = new URLSearchParams();
        formData.append('To', formattedPhone);
        formData.append('Channel', 'sms');
        
        const verifySendResponse = await fetch(verifySendUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${base64Credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData.toString(),
        });
        
        if (verifySendResponse.ok) {
          const verifyData = await verifySendResponse.json();
          console.log(`   ✅ Verification code sent!`);
          console.log(`   Status: ${verifyData.status}`);
          console.log(`   SID: ${verifyData.sid}`);
          console.log(`\n💡 If this works, it means your number CAN receive SMS`);
          console.log(`   The issue is likely with regular SMS messages from trial accounts`);
        } else {
          const errorText = await verifySendResponse.text();
          console.log(`   ❌ Failed: ${verifySendResponse.status}`);
          try {
            const errorData = JSON.parse(errorText);
            console.log(`   Error: ${errorData.message || 'Unknown'}`);
          } catch {
            console.log(`   ${errorText}`);
          }
        }
      } else {
        console.log(`⚠️  No Verify Service found. Creating one...`);
        
        // Create a Verify Service
        const createServiceUrl = `https://verify.twilio.com/v2/Services`;
        const createFormData = new URLSearchParams();
        createFormData.append('FriendlyName', 'Revol Notifications');
        
        const createResponse = await fetch(createServiceUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${base64Credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: createFormData.toString(),
        });
        
        if (createResponse.ok) {
          const serviceData = await createResponse.json();
          console.log(`   ✅ Created Verify Service: ${serviceData.sid}`);
          console.log(`\n💡 Verify Service created, but this is for verification codes only`);
          console.log(`   Regular SMS notifications still need to use the Messages API`);
        } else {
          const errorText = await createResponse.text();
          console.log(`   ❌ Failed to create service: ${createResponse.status}`);
          console.log(`   ${errorText}`);
        }
      }
    } else {
      console.log(`⚠️  Could not access Verify API: ${servicesResponse.status}`);
    }
  } catch (error) {
    console.error(`❌ Error:`, error);
  }
  
  console.log(`\n💡 Alternative Solutions:`);
  console.log(`   1. Check if your number is a VoIP number (Google Voice, TextNow, etc.)`);
  console.log(`      → VoIP numbers often don't support SMS properly`);
  console.log(`   2. Try using a different phone number (real mobile carrier)`);
  console.log(`   3. Check if your carrier blocks trial account messages`);
  console.log(`   4. The "Unknown" carrier type suggests the number might not be a standard mobile number`);
  console.log(`   5. Contact your carrier to ensure SMS is enabled on your number`);
}

const phoneNumber = process.argv[2] || '+19087237864';
tryVerifyAPI(phoneNumber)
  .then(() => {
    console.log('\n✅ Test complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

