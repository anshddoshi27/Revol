/**
 * Create Test Notification Templates
 * 
 * Creates basic templates for testing the notification system
 * 
 * Usage:
 *   npx tsx apps/web/src/lib/__tests__/create-test-templates.ts
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

async function createTestTemplates() {
  console.log('🔧 Creating test notification templates...\n');
  
  const supabase = createAdminClient();
  
  // Get a Pro Plan business
  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, user_id, notifications_enabled')
    .eq('notifications_enabled', true)
    .limit(1)
    .single();
  
  if (!business) {
    console.error('❌ No Pro Plan business found');
    console.error('   Update a business to have notifications_enabled = true');
    process.exit(1);
  }
  
  console.log(`📦 Business: ${business.name} (${business.id})`);
  console.log(`   User ID: ${business.user_id}\n`);
  
  // Check if templates already exist
  const { data: existing } = await supabase
    .from('notification_templates')
    .select('id, trigger, channel')
    .eq('business_id', business.id)
    .is('deleted_at', null);
  
  if (existing && existing.length > 0) {
    console.log(`⚠️  Found ${existing.length} existing template(s):`);
    existing.forEach(t => {
      console.log(`   - ${t.trigger} (${t.channel})`);
    });
    console.log('');
    console.log('💡 Delete existing templates first if you want to recreate them');
    return;
  }
  
  // Create test templates
  const templates = [
    {
      user_id: business.user_id,
      business_id: business.id,
      trigger: 'booking_created',
      channel: 'email',
      category: 'confirmation', // notification_category enum value
      name: 'Booking Confirmation Email',
      subject: 'We received your booking — no charge yet',
      body_markdown: `Hi \${customer.name},

Your \${service.name} appointment with \${staff.name} is confirmed for \${booking.date} at \${booking.time}.

No payment has been taken. We'll only charge after your appointment per \${business.name} policies.

View your booking: \${booking.url}

\${business.name}`,
      is_enabled: true,
      created_at: new Date().toISOString(),
    },
    {
      user_id: business.user_id,
      business_id: business.id,
      trigger: 'booking_created',
      channel: 'sms',
      category: 'confirmation', // notification_category enum value
      name: 'Booking Confirmation SMS',
      subject: null,
      body_markdown: `Hi \${customer.name}, your \${service.name} booking is confirmed for \${booking.date} at \${booking.time}. No charge yet. \${business.name}`,
      is_enabled: true,
      created_at: new Date().toISOString(),
    },
  ];
  
  console.log('📝 Creating templates...');
  const { data: created, error } = await supabase
    .from('notification_templates')
    .insert(templates)
    .select();
  
  if (error) {
    console.error('❌ Error creating templates:', error);
    process.exit(1);
  }
  
  console.log(`✅ Created ${created?.length || 0} template(s):\n`);
  created?.forEach((template, index) => {
    console.log(`${index + 1}. ${template.name}`);
    console.log(`   Trigger: ${template.trigger}`);
    console.log(`   Channel: ${template.channel}`);
    console.log(`   Enabled: ${template.is_enabled ? '✅' : '❌'}`);
    console.log('');
  });
  
  console.log('✅ Templates created successfully!');
  console.log('   Now you can test notifications with:');
  console.log('   npx tsx apps/web/src/lib/__tests__/test-notifications-live.ts');
}

createTestTemplates()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

