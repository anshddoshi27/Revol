/**
 * Check recent Twilio messages to see delivery status
 * 
 * Usage:
 *   npx tsx apps/web/src/lib/__tests__/check-twilio-messages.ts
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

async function checkTwilioMessages() {
  console.log('🔍 Checking recent Twilio messages...\n');
  
  const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFromNumber = process.env.TWILIO_FROM_NUMBER;
  
  if (!twilioAccountSid || !twilioAuthToken) {
    console.error('❌ Twilio credentials not configured');
    process.exit(1);
  }
  
  console.log(`📋 Configuration:`);
  console.log(`   Account SID: ${twilioAccountSid.substring(0, 8)}...`);
  console.log(`   From Number: ${twilioFromNumber}\n`);
  
  try {
    // Get messages from the last 24 hours
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0]; // YYYY-MM-DD
    
    const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json?DateSent>=${dateStr}&PageSize=20`;
    const credentials = `${twilioAccountSid}:${twilioAuthToken}`;
    const base64Credentials = btoa(credentials);
    
    console.log('📤 Fetching messages from Twilio...\n');
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${base64Credentials}`,
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Failed to fetch messages: ${response.status}`);
      console.error(`   ${errorText}`);
      process.exit(1);
    }
    
    const data = await response.json();
    const messages = data.messages || [];
    
    console.log(`📱 Found ${messages.length} message(s) in the last 24 hours:\n`);
    
    if (messages.length === 0) {
      console.log('⚠️  No messages found');
      console.log('   This could mean:');
      console.log('   - No messages were sent');
      console.log('   - Messages were sent more than 24 hours ago');
      console.log('   - There was an error sending messages');
    } else {
      for (const message of messages) {
        console.log(`📨 Message ${message.sid}:`);
        console.log(`   From: ${message.from}`);
        console.log(`   To: ${message.to}`);
        console.log(`   Status: ${message.status}`);
        console.log(`   Date Sent: ${message.date_sent || 'Not sent yet'}`);
        console.log(`   Date Created: ${message.date_created}`);
        
        if (message.error_code) {
          console.log(`   ❌ Error Code: ${message.error_code}`);
          console.log(`   ❌ Error Message: ${message.error_message}`);
        }
        
        if (message.status === 'delivered') {
          console.log(`   ✅ Delivered successfully`);
        } else if (message.status === 'sent') {
          console.log(`   ⏳ Sent to carrier, delivery pending`);
        } else if (message.status === 'queued') {
          console.log(`   ⏳ Queued for sending`);
        } else if (message.status === 'failed' || message.status === 'undelivered') {
          console.log(`   ❌ Failed to deliver`);
        }
        
        console.log(`   Body: ${message.body?.substring(0, 50)}${message.body?.length > 50 ? '...' : ''}`);
        console.log('');
      }
      
      // Check for messages to the user's number
      const userNumber = '+19087237864';
      const userMessages = messages.filter(m => m.to === userNumber);
      
      if (userMessages.length > 0) {
        console.log(`\n📱 Messages to ${userNumber}:`);
        for (const msg of userMessages) {
          console.log(`   ${msg.sid}: ${msg.status} - ${msg.date_sent || 'Not sent'}`);
          if (msg.status === 'delivered') {
            console.log(`      ✅ This message was delivered!`);
          } else if (msg.status === 'sent') {
            console.log(`      ⏳ Sent to carrier, may take a few minutes to deliver`);
          } else if (msg.status === 'failed' || msg.status === 'undelivered') {
            console.log(`      ❌ Failed: ${msg.error_message || 'Unknown error'}`);
          }
        }
      } else {
        console.log(`\n⚠️  No messages found to ${userNumber}`);
        console.log(`   This means Twilio never received a request to send to this number`);
      }
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkTwilioMessages()
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

