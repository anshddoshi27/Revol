/**
 * Check Notification Templates for a Business
 * 
 * Usage:
 *   npx tsx apps/web/src/lib/__tests__/check-templates.ts
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

async function checkTemplates() {
  console.log('🔍 Checking notification templates...\n');
  
  const supabase = createAdminClient();
  
  // Get a Pro Plan business
  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, notifications_enabled')
    .eq('notifications_enabled', true)
    .limit(1)
    .single();
  
  if (!business) {
    console.error('❌ No Pro Plan business found');
    process.exit(1);
  }
  
  console.log(`📦 Business: ${business.name} (${business.id})`);
  console.log(`   Notifications Enabled: ${business.notifications_enabled}\n`);
  
  // Get templates
  const { data: templates, error } = await supabase
    .from('notification_templates')
    .select('*')
    .eq('business_id', business.id)
    .is('deleted_at', null)
    .order('trigger', { ascending: true });
  
  if (error) {
    console.error('❌ Error fetching templates:', error);
    process.exit(1);
  }
  
  if (!templates || templates.length === 0) {
    console.log('⚠️  No notification templates found for this business');
    console.log('');
    console.log('💡 To create templates:');
    console.log('   1. Go through onboarding Step 8 (Notifications)');
    console.log('   2. Select Pro Plan');
    console.log('   3. Configure at least one template for "booking_created" trigger');
    console.log('   4. Enable the template');
    return;
  }
  
  console.log(`📋 Found ${templates.length} template(s):\n`);
  
  templates.forEach((template, index) => {
    console.log(`${index + 1}. ${template.name || 'Unnamed Template'}`);
    console.log(`   Trigger: ${template.trigger}`);
    console.log(`   Channel: ${template.channel}`);
    console.log(`   Enabled: ${template.is_enabled ? '✅ Yes' : '❌ No'}`);
    if (template.subject) {
      console.log(`   Subject: ${template.subject.substring(0, 50)}...`);
    }
    console.log(`   Body: ${template.body_markdown?.substring(0, 50) || 'N/A'}...`);
    console.log('');
  });
  
  // Check for booking_created templates
  const bookingCreatedTemplates = templates.filter(t => 
    t.trigger === 'booking_created' && t.is_enabled
  );
  
  if (bookingCreatedTemplates.length === 0) {
    console.log('⚠️  No enabled "booking_created" templates found!');
    console.log('   This is why notifications aren\'t being created.');
    console.log('');
    console.log('💡 Solution:');
    console.log('   - Create a template with trigger = "booking_created"');
    console.log('   - Set is_enabled = true');
    console.log('   - Configure for email or SMS channel');
  } else {
    console.log(`✅ Found ${bookingCreatedTemplates.length} enabled "booking_created" template(s)`);
  }
}

checkTemplates()
  .then(() => {
    console.log('✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

