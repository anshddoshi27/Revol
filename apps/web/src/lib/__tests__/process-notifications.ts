/**
 * Manually Process Notification Jobs
 * 
 * This script manually triggers the cron job to process pending notifications
 * 
 * Usage:
 *   npx tsx apps/web/src/lib/__tests__/process-notifications.ts
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

const CRON_SECRET = process.env.CRON_SECRET || 'test-secret';
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

async function processNotifications() {
  console.log('🔄 Processing notification jobs...\n');
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   Cron Secret: ${CRON_SECRET.substring(0, 8)}...\n`);
  
  try {
    const response = await fetch(`${BASE_URL}/api/cron/notifications`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
      },
    });
    
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
    
    if (!response.ok) {
      console.error('❌ Failed to process notifications:');
      console.error(`   Status: ${response.status}`);
      console.error(`   Response:`, data);
      process.exit(1);
    }
    
    console.log('✅ Cron job executed successfully');
    console.log('   Response:', data);
    console.log('');
    console.log('📊 Check notification jobs status:');
    console.log('   npx tsx apps/web/src/lib/__tests__/check-notification-jobs.ts');
    
  } catch (error) {
    console.error('❌ Error calling cron endpoint:', error);
    console.error('');
    console.error('💡 Make sure:');
    console.error('   1. Your app is running (npm run dev)');
    console.error('   2. CRON_SECRET is set in .env file');
    console.error('   3. NEXT_PUBLIC_APP_URL is set (or defaults to http://localhost:3000)');
    process.exit(1);
  }
}

processNotifications()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

