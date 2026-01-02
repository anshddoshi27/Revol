/**
 * Enable SMS template for booking_created
 * 
 * Usage:
 *   npx tsx apps/web/src/lib/__tests__/enable-sms-template.ts [businessId]
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

async function enableSMSTemplate(businessId?: string) {
  console.log('🔧 Enabling SMS template...\n');
  
  const supabase = createAdminClient();
  
  // Get business
  let business;
  if (businessId) {
    const { data, error } = await supabase
      .from('businesses')
      .select('id, name, user_id, notifications_enabled')
      .eq('id', businessId)
      .single();
    
    if (error || !data) {
      console.error(`❌ Business ${businessId} not found`);
      process.exit(1);
    }
    business = data;
  } else {
    // Get most recent Pro Plan business
    const { data, error } = await supabase
      .from('businesses')
      .select('id, name, user_id, notifications_enabled')
      .eq('notifications_enabled', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error || !data) {
      console.error('❌ No Pro Plan business found');
      process.exit(1);
    }
    business = data;
  }
  
  console.log(`📦 Business: ${business.name} (${business.id})`);
  console.log(`   User ID: ${business.user_id}\n`);
  
  // Check existing SMS template
  const { data: existingSMS, error: checkError } = await supabase
    .from('notification_templates')
    .select('*')
    .eq('business_id', business.id)
    .eq('user_id', business.user_id)
    .eq('trigger', 'booking_created')
    .eq('channel', 'sms')
    .is('deleted_at', null)
    .maybeSingle();
  
  if (checkError) {
    console.error('❌ Error checking templates:', checkError);
    process.exit(1);
  }
  
  if (existingSMS) {
    // Enable existing template
    console.log('📋 Found existing SMS template, enabling it...');
    const { error: updateError } = await supabase
      .from('notification_templates')
      .update({
        is_enabled: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingSMS.id);
    
    if (updateError) {
      console.error('❌ Error enabling template:', updateError);
      process.exit(1);
    }
    
    console.log('✅ SMS template enabled!');
    console.log(`   Template: ${existingSMS.name || 'Unnamed'}`);
    console.log(`   Body: ${existingSMS.body_markdown?.substring(0, 50) || 'N/A'}...\n`);
  } else {
    // Create new SMS template
    console.log('📋 Creating new SMS template...');
    
    // Get email template as reference
    const { data: emailTemplate } = await supabase
      .from('notification_templates')
      .select('*')
      .eq('business_id', business.id)
      .eq('user_id', business.user_id)
      .eq('trigger', 'booking_created')
      .eq('channel', 'email')
      .is('deleted_at', null)
      .maybeSingle();
    
    const defaultBody = emailTemplate?.body_markdown 
      ? emailTemplate.body_markdown.replace(/\n/g, ' ').substring(0, 160) // SMS limit
      : 'Hi ${customer.name}, your ${service.name} booking is confirmed for ${booking.date} at ${booking.time}. See you then!';
    
    const { data: newTemplate, error: createError } = await supabase
      .from('notification_templates')
      .insert({
        business_id: business.id,
        user_id: business.user_id,
        name: 'Booking Confirmation SMS',
        channel: 'sms',
        category: 'confirmation',
        trigger: 'booking_created',
        body_markdown: defaultBody,
        is_enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (createError) {
      console.error('❌ Error creating template:', createError);
      process.exit(1);
    }
    
    console.log('✅ SMS template created and enabled!');
    console.log(`   Template ID: ${newTemplate.id}`);
    console.log(`   Body: ${newTemplate.body_markdown}\n`);
  }
  
  console.log('💡 For future bookings, SMS will be sent automatically!');
}

const businessId = process.argv[2];
enableSMSTemplate(businessId)
  .then(() => {
    console.log('✅ Complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

