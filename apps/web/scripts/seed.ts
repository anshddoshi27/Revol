/**
 * Seed script for Tithi development and testing
 * 
 * Creates a complete demo business with:
 * - One demo owner user
 * - One business with full configuration
 * - Categories, services, staff, availability
 * - Policies, gift cards, notification templates
 * - Multiple bookings across all statuses
 * 
 * Usage:
 *   npx tsx scripts/seed.ts
 * 
 * Environment variables required:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 * 
 * These should be in .env file in apps/web/
 */

// Load environment variables from .env
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../.env') });

import { createAdminClient } from '../src/lib/db';
import { createClient } from '@supabase/supabase-js';

const DEMO_OWNER_EMAIL = 'demo@tithi.com'; // Changed from .dev to .com for Supabase email validation
const DEMO_OWNER_PASSWORD = 'Tithi2025$Demo'; // Meets Supabase requirements: uppercase, lowercase, number, special char, unique
const DEMO_OWNER_NAME = 'Demo Owner';
const DEMO_BUSINESS_NAME = 'Demo Salon';
const DEMO_SUBDOMAIN = 'demo';

async function seed() {
  console.log('🌱 Starting seed script...\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('\n❌ Missing required environment variables!\n');
    console.error('Please ensure your `.env` file in apps/web/ contains:');
    console.error('  NEXT_PUBLIC_SUPABASE_URL=your-supabase-url');
    console.error('  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key\n');
    console.error('See ENV_SETUP.md for detailed instructions.\n');
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  const supabase = createAdminClient();
  const authClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    // Step 1: Create or get demo owner user
    console.log('1️⃣ Creating demo owner user...');
    let userId: string;
    let userEmail = DEMO_OWNER_EMAIL;

    // Check if user already exists (by new email or old email)
    const { data: existingUsers } = await authClient.auth.admin.listUsers();
    const foundUserByNewEmail = existingUsers?.users.find(u => u.email === DEMO_OWNER_EMAIL);
    const foundUserByOldEmail = existingUsers?.users.find(u => u.email === 'demo@tithi.dev');

    // Prefer the new email user, but also check for old email user
    let foundUser = foundUserByNewEmail || foundUserByOldEmail;

    if (foundUser) {
      console.log(`   ✓ User already exists: ${foundUser.email}`);
      userId = foundUser.id;
      
      // Update email if it's the old email
      if (foundUser.email === 'demo@tithi.dev') {
        console.log(`   🔄 Updating email from ${foundUser.email} to ${DEMO_OWNER_EMAIL}...`);
        const { error: emailError } = await authClient.auth.admin.updateUserById(userId, {
          email: DEMO_OWNER_EMAIL,
        });
        
        if (emailError) {
          console.warn(`   ⚠️  Could not update email: ${emailError.message}`);
          console.warn(`   ⚠️  The user exists with old email. You can manually update it in Supabase Dashboard.`);
          console.warn(`   ⚠️  For now, you can log in with: ${foundUser.email}`);
        } else {
          console.log(`   ✓ Email updated to ${DEMO_OWNER_EMAIL}`);
        }
      }
      
      // Try to update password
      const { error: updateError } = await authClient.auth.admin.updateUserById(userId, {
        password: DEMO_OWNER_PASSWORD,
      });
      
      if (updateError) {
        console.warn(`   ⚠️  Could not update password: ${updateError.message}`);
        console.warn(`   ⚠️  Password update via admin API may be restricted.`);
        console.warn(`   ⚠️  `);
        console.warn(`   ⚠️  To update password, you can:`);
        console.warn(`   ⚠️  1. Use the helper script: npx tsx scripts/update-user-password.ts ${foundUser.email} "${DEMO_OWNER_PASSWORD}"`);
        console.warn(`   ⚠️  2. Or use Supabase CLI: supabase auth admin update-user-by-id ${userId} --password "${DEMO_OWNER_PASSWORD}"`);
        console.warn(`   ⚠️  3. Or manually in Supabase Dashboard: Click user > "Send password recovery"`);
      } else {
        console.log(`   ✓ Password updated successfully`);
      }
    } else {
      const { data: newUser, error: userError } = await authClient.auth.admin.createUser({
        email: DEMO_OWNER_EMAIL,
        password: DEMO_OWNER_PASSWORD,
        email_confirm: true,
        user_metadata: {
          name: DEMO_OWNER_NAME,
        },
      });

      if (userError || !newUser.user) {
        throw new Error(`Failed to create user: ${userError?.message}`);
      }

      userId = newUser.user.id;
      console.log(`   ✓ Created user: ${newUser.user.email}`);
    }

    // Step 2: Create or get business
    console.log('\n2️⃣ Creating business...');
    let businessId: string;

    // First check if business exists for this user
    const { data: existingBusinessByUser } = await supabase
      .from('businesses')
      .select('id, user_id')
      .eq('user_id', userId)
      .maybeSingle();

    // Also check if business with subdomain exists (might belong to old user)
    const { data: existingBusinessBySubdomain } = await supabase
      .from('businesses')
      .select('id, user_id')
      .eq('subdomain', DEMO_SUBDOMAIN)
      .maybeSingle();

    // Use business by user_id if exists, otherwise use by subdomain (and update user_id)
    let existingBusiness = existingBusinessByUser || existingBusinessBySubdomain;

    if (existingBusiness) {
      if (existingBusiness.user_id === userId) {
        console.log(`   ✓ Business already exists for this user: ${existingBusiness.id}`);
      } else {
        console.log(`   ✓ Business exists with subdomain "demo" but belongs to different user`);
        console.log(`   🔄 Updating business to belong to current user...`);
        
        // Update the business to belong to the current user
        const { error: updateUserError } = await supabase
          .from('businesses')
          .update({ user_id: userId })
          .eq('id', existingBusiness.id);
        
        if (updateUserError) {
          throw new Error(`Failed to update business user_id: ${updateUserError.message}`);
        }
        console.log(`   ✓ Business updated to belong to current user`);
      }
      
      businessId = existingBusiness.id;
      
      // Update business to ensure it's configured
      const updateData: any = {
        name: DEMO_BUSINESS_NAME,
        subdomain: DEMO_SUBDOMAIN,
        timezone: 'America/New_York',
        phone: '+15551234567',
        support_email: 'support@demosalon.com',
        website_url: 'https://demosalon.com',
        street: '123 Main Street',
        city: 'New York',
        state: 'NY',
        postal_code: '10001',
        country: 'United States',
        brand_primary_color: '#4ECDC4',
        brand_secondary_color: '#FF6B6B',
        subscription_status: 'active',
      };
      
      // Only set notifications_enabled if the column exists (migration has been run)
      // The migration adds this column with a default of true, so it's optional
      await supabase
        .from('businesses')
        .update(updateData)
        .eq('id', businessId);
    } else {
      const businessData: any = {
        user_id: userId,
        name: DEMO_BUSINESS_NAME,
        dba_name: 'Demo Salon DBA',
        legal_name: 'Demo Salon LLC',
        industry: 'Beauty & Wellness',
        subdomain: DEMO_SUBDOMAIN,
        timezone: 'America/New_York',
        phone: '+15551234567',
        support_email: 'support@demosalon.com',
        website_url: 'https://demosalon.com',
        street: '123 Main Street',
        city: 'New York',
        state: 'NY',
        postal_code: '10001',
        country: 'United States',
        brand_primary_color: '#4ECDC4',
        brand_secondary_color: '#FF6B6B',
        subscription_status: 'active',
        stripe_connect_account_id: 'acct_test_demo123', // Test account ID
      };
      
      // Only include notifications_enabled if the migration has been run
      // The migration adds this column with a default of true, so it's optional
      
      const { data: newBusiness, error: businessError } = await supabase
        .from('businesses')
        .insert(businessData)
        .select('id')
        .single();

      if (businessError || !newBusiness) {
        throw new Error(`Failed to create business: ${businessError?.message}`);
      }

      businessId = newBusiness.id;
      console.log(`   ✓ Created business: ${newBusiness.id}`);
    }

    // Step 3: Create service categories
    console.log('\n3️⃣ Creating service categories...');
    const categories = [
      { name: 'Hair Services', description: 'All hair-related services', color: '#4ECDC4', sort_order: 1 },
      { name: 'Nail Services', description: 'Manicures and pedicures', color: '#FF6B6B', sort_order: 2 },
    ];

    const categoryIds: string[] = [];
    for (const category of categories) {
      const { data: existing } = await supabase
        .from('service_categories')
        .select('id')
        .eq('business_id', businessId)
        .eq('name', category.name)
        .maybeSingle();

      if (existing) {
        categoryIds.push(existing.id);
        await supabase
          .from('service_categories')
          .update(category)
          .eq('id', existing.id);
      } else {
        const { data: newCategory, error } = await supabase
          .from('service_categories')
          .insert({
            user_id: userId,
            business_id: businessId,
            ...category,
            is_active: true,
          })
          .select('id')
          .single();

        if (error || !newCategory) {
          throw new Error(`Failed to create category: ${error?.message}`);
        }
        categoryIds.push(newCategory.id);
      }
    }
    console.log(`   ✓ Created ${categoryIds.length} categories`);

    // Step 4: Create services
    console.log('\n4️⃣ Creating services...');
    const services = [
      {
        category_id: categoryIds[0],
        name: 'Haircut',
        description: 'Professional haircut and styling',
        duration_min: 30,
        price_cents: 5000, // $50
        pre_appointment_instructions: 'Please arrive 10 minutes early. Bring any reference photos.',
      },
      {
        category_id: categoryIds[0],
        name: 'Color Treatment',
        description: 'Full color service with consultation',
        duration_min: 90,
        price_cents: 15000, // $150
        pre_appointment_instructions: 'Please arrive 15 minutes early. Avoid washing hair 24 hours before.',
      },
      {
        category_id: categoryIds[1],
        name: 'Manicure',
        description: 'Classic manicure with polish',
        duration_min: 45,
        price_cents: 3500, // $35
        pre_appointment_instructions: 'Please remove any existing polish before arrival.',
      },
    ];

    const serviceIds: string[] = [];
    for (const service of services) {
      const { data: existing } = await supabase
        .from('services')
        .select('id')
        .eq('business_id', businessId)
        .eq('name', service.name)
        .maybeSingle();

      if (existing) {
        serviceIds.push(existing.id);
        await supabase
          .from('services')
          .update(service)
          .eq('id', existing.id);
      } else {
        const { data: newService, error } = await supabase
          .from('services')
          .insert({
            user_id: userId,
            business_id: businessId,
            ...service,
            is_active: true,
          })
          .select('id')
          .single();

        if (error || !newService) {
          throw new Error(`Failed to create service: ${error?.message}`);
        }
        serviceIds.push(newService.id);
      }
    }
    console.log(`   ✓ Created ${serviceIds.length} services`);

    // Step 5: Create staff
    console.log('\n5️⃣ Creating staff...');
    const staffMembers = [
      { name: 'Jane Doe', role: 'Senior Stylist', color: '#4ECDC4' },
      { name: 'John Smith', role: 'Color Specialist', color: '#FF6B6B' },
    ];

    const staffIds: string[] = [];
    for (const staff of staffMembers) {
      const { data: existing } = await supabase
        .from('staff')
        .select('id')
        .eq('business_id', businessId)
        .eq('name', staff.name)
        .maybeSingle();

      if (existing) {
        staffIds.push(existing.id);
        await supabase
          .from('staff')
          .update(staff)
          .eq('id', existing.id);
      } else {
        const { data: newStaff, error } = await supabase
          .from('staff')
          .insert({
            user_id: userId,
            business_id: businessId,
            ...staff,
            is_active: true,
          })
          .select('id')
          .single();

        if (error || !newStaff) {
          throw new Error(`Failed to create staff: ${error?.message}`);
        }
        staffIds.push(newStaff.id);
      }
    }
    console.log(`   ✓ Created ${staffIds.length} staff members`);

    // Step 6: Link staff to services
    console.log('\n6️⃣ Linking staff to services...');
    // Jane can do all services, John can do color and manicure
    const staffServiceLinks = [
      { staff_id: staffIds[0], service_id: serviceIds[0] }, // Jane - Haircut
      { staff_id: staffIds[0], service_id: serviceIds[1] }, // Jane - Color
      { staff_id: staffIds[0], service_id: serviceIds[2] }, // Jane - Manicure
      { staff_id: staffIds[1], service_id: serviceIds[1] }, // John - Color
      { staff_id: staffIds[1], service_id: serviceIds[2] }, // John - Manicure
    ];

    for (const link of staffServiceLinks) {
      const { data: existing } = await supabase
        .from('staff_services')
        .select('id')
        .eq('staff_id', link.staff_id)
        .eq('service_id', link.service_id)
        .maybeSingle();

      if (!existing) {
        await supabase
          .from('staff_services')
          .insert({
            user_id: userId,
            business_id: businessId,
            ...link,
          });
      }
    }
    console.log(`   ✓ Linked staff to services`);

    // Step 7: Create availability rules
    console.log('\n7️⃣ Creating availability rules...');
    // Monday-Friday, 9 AM - 5 PM for each staff+service combo
    const weekdays = [1, 2, 3, 4, 5]; // Monday = 1, Friday = 5
    let ruleCount = 0;

    for (const link of staffServiceLinks) {
      for (const weekday of weekdays) {
        const { data: existing } = await supabase
          .from('availability_rules')
          .select('id')
          .eq('staff_id', link.staff_id)
          .eq('service_id', link.service_id)
          .eq('weekday', weekday)
          .eq('rule_type', 'weekly')
          .maybeSingle();

        if (!existing) {
          await supabase
            .from('availability_rules')
            .insert({
              user_id: userId,
              business_id: businessId,
              staff_id: link.staff_id,
              service_id: link.service_id,
              rule_type: 'weekly',
              weekday,
              start_time: '09:00',
              end_time: '17:00',
              capacity: 1,
            });
          ruleCount++;
        }
      }
    }
    console.log(`   ✓ Created ${ruleCount} availability rules`);

    // Step 8: Create policies
    console.log('\n8️⃣ Creating policies...');
    const { data: existingPolicy } = await supabase
      .from('business_policies')
      .select('id')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .maybeSingle();

    if (existingPolicy) {
      await supabase
        .from('business_policies')
        .update({
          version: 1,
          cancellation_policy_text: 'Cancellations must be made at least 24 hours in advance to receive a full refund. Cancellations made less than 24 hours before the appointment will incur a 50% cancellation fee.',
          no_show_policy_text: 'No-show appointments will be charged a 50% no-show fee based on the service price.',
          refund_policy_text: 'Refunds are available within 48 hours of service completion.',
          cash_payment_policy_text: 'We accept cash payments at the time of service.',
          no_show_fee_type: 'percent',
          no_show_fee_amount_cents: 0,
          no_show_fee_percent: 50.0,
          cancel_fee_type: 'percent',
          cancel_fee_amount_cents: 0,
          cancel_fee_percent: 50.0,
        })
        .eq('id', existingPolicy.id);
    } else {
      await supabase
        .from('business_policies')
        .insert({
          user_id: userId,
          business_id: businessId,
          version: 1,
          cancellation_policy_text: 'Cancellations must be made at least 24 hours in advance to receive a full refund. Cancellations made less than 24 hours before the appointment will incur a 50% cancellation fee.',
          no_show_policy_text: 'No-show appointments will be charged a 50% no-show fee based on the service price.',
          refund_policy_text: 'Refunds are available within 48 hours of service completion.',
          cash_payment_policy_text: 'We accept cash payments at the time of service.',
          no_show_fee_type: 'percent',
          no_show_fee_amount_cents: 0,
          no_show_fee_percent: 50.0,
          cancel_fee_type: 'percent',
          cancel_fee_amount_cents: 0,
          cancel_fee_percent: 50.0,
          is_active: true,
        });
    }
    console.log(`   ✓ Created policies`);

    // Step 9: Create gift cards
    console.log('\n9️⃣ Creating gift cards...');
    const giftCards = [
      {
        code: 'DEMO50',
        discount_type: 'amount',
        initial_amount_cents: 5000, // $50
        current_balance_cents: 5000,
        percent_off: null,
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
      },
      {
        code: 'DEMO20',
        discount_type: 'percent',
        initial_amount_cents: 0,
        current_balance_cents: 0,
        percent_off: 20.0,
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];

    const giftCardIds: string[] = [];
    for (const card of giftCards) {
      const { data: existing } = await supabase
        .from('gift_cards')
        .select('id')
        .eq('business_id', businessId)
        .eq('code', card.code)
        .maybeSingle();

      if (existing) {
        giftCardIds.push(existing.id);
        await supabase
          .from('gift_cards')
          .update(card)
          .eq('id', existing.id);
      } else {
        const { data: newCard, error } = await supabase
          .from('gift_cards')
          .insert({
            user_id: userId,
            business_id: businessId,
            ...card,
            is_active: true,
          })
          .select('id')
          .single();

        if (error || !newCard) {
          throw new Error(`Failed to create gift card: ${error?.message}`);
        }
        giftCardIds.push(newCard.id);
      }
    }
    console.log(`   ✓ Created ${giftCardIds.length} gift cards`);

    // Step 10: Create notification templates
    console.log('\n🔟 Creating notification templates...');
    const templates = [
      {
        name: 'Booking Confirmation',
        channel: 'email',
        category: 'confirmation',
        trigger: 'booking_created',
        subject: 'Booking received — no charge yet',
        body_markdown: 'Hi ${customer.name}, we received your booking for ${service.name} on ${booking.date} at ${booking.time}. No payment has been taken. We\'ll only charge after your appointment per ${business.name} policies. View booking: ${booking.url}',
        is_enabled: true,
      },
      {
        name: '24 Hour Reminder',
        channel: 'sms',
        category: 'reminder',
        trigger: 'reminder_24h',
        subject: null,
        body_markdown: 'Friendly reminder: ${service.name} on ${booking.date} at ${booking.time}. Reply C to cancel. Policies: ${booking.url}',
        is_enabled: true,
      },
      {
        name: '1 Hour Reminder',
        channel: 'sms',
        category: 'reminder',
        trigger: 'reminder_1h',
        subject: null,
        body_markdown: 'See you soon! ${service.name} starts in 1 hour at ${booking.time}.',
        is_enabled: true,
      },
      {
        name: 'Booking Completed',
        channel: 'email',
        category: 'completion',
        trigger: 'booking_completed',
        subject: 'Receipt for ${service.name}',
        body_markdown: 'Thank you for visiting ${business.name}! Your ${service.name} on ${booking.date} has been completed. Total charged: ${booking.amount}.',
        is_enabled: true,
      },
      {
        name: 'Fee Charged',
        channel: 'email',
        category: 'cancellation',
        trigger: 'fee_charged',
        subject: 'Fee processed for ${service.name}',
        body_markdown: 'Hi ${customer.name}, we applied a fee for ${service.name} per policy. Total charged: ${amount}. View details: ${booking.url}',
        is_enabled: true,
      },
    ];

    for (const template of templates) {
      const { data: existing } = await supabase
        .from('notification_templates')
        .select('id')
        .eq('business_id', businessId)
        .eq('trigger', template.trigger)
        .eq('channel', template.channel)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('notification_templates')
          .update(template)
          .eq('id', existing.id);
      } else {
        await supabase
          .from('notification_templates')
          .insert({
            user_id: userId,
            business_id: businessId,
            ...template,
          });
      }
    }
    console.log(`   ✓ Created ${templates.length} notification templates`);

    // Step 11: Create customers
    console.log('\n1️⃣1️⃣ Creating customers...');
    const customerData = [
      { name: 'Alice Johnson', email: 'alice@example.com', phone: '+15551234567' },
      { name: 'Bob Williams', email: 'bob@example.com', phone: '+15551234568' },
      { name: 'Carol Davis', email: 'carol@example.com', phone: '+15551234569' },
      { name: 'David Brown', email: 'david@example.com', phone: '+15551234570' },
      { name: 'Eve Miller', email: 'eve@example.com', phone: '+15551234571' },
      { name: 'Frank Wilson', email: 'frank@example.com', phone: '+15551234572' },
      { name: 'Grace Moore', email: 'grace@example.com', phone: '+15551234573' },
      { name: 'Henry Taylor', email: 'henry@example.com', phone: '+15551234574' },
      { name: 'Iris Anderson', email: 'iris@example.com', phone: '+15551234575' },
      { name: 'Jack Thomas', email: 'jack@example.com', phone: '+15551234576' },
    ];

    const customerIds: string[] = [];
    for (const customer of customerData) {
      const { data: existing } = await supabase
        .from('customers')
        .select('id')
        .eq('business_id', businessId)
        .eq('email', customer.email)
        .maybeSingle();

      if (existing) {
        customerIds.push(existing.id);
        await supabase
          .from('customers')
          .update(customer)
          .eq('id', existing.id);
      } else {
        const { data: newCustomer, error } = await supabase
          .from('customers')
          .insert({
            user_id: userId,
            business_id: businessId,
            ...customer,
          })
          .select('id')
          .single();

        if (error || !newCustomer) {
          throw new Error(`Failed to create customer: ${error?.message}`);
        }
        customerIds.push(newCustomer.id);
      }
    }
    console.log(`   ✓ Created ${customerIds.length} customers`);

    // Step 12: Create bookings across all statuses
    console.log('\n1️⃣2️⃣ Creating bookings...');
    const now = new Date();
    
    // Helper to create booking data with proper service/staff references
    const createBooking = (
      customerIdx: number,
      serviceIdx: number,
      staffIdx: number,
      status: string,
      daysOffset: number,
      priceCents: number,
      finalPriceCents: number,
      paymentStatus: string,
      lastMoneyAction: string,
      giftCardIdx?: number
    ) => {
      const service = services[serviceIdx];
      const start = new Date(now.getTime() + daysOffset * 24 * 60 * 60 * 1000);
      const end = new Date(start.getTime() + (service.duration_min || 30) * 60 * 1000);
      
      return {
        customer_id: customerIds[customerIdx],
        service_id: serviceIds[serviceIdx],
        staff_id: staffIds[staffIdx],
        status,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        duration_min: service.duration_min || 30,
        price_cents: priceCents,
        final_price_cents: finalPriceCents,
        payment_status: paymentStatus,
        last_money_action: lastMoneyAction,
        gift_card_id: giftCardIdx !== undefined ? giftCardIds[giftCardIdx] : null,
        gift_card_amount_applied_cents: giftCardIdx !== undefined ? (priceCents - finalPriceCents) : 0,
        policy_snapshot: {
          cancellation_policy_text: 'Cancellations must be made at least 24 hours in advance.',
          no_show_policy_text: 'No-show appointments will be charged a 50% no-show fee.',
          refund_policy_text: 'Refunds are available within 48 hours.',
          cash_payment_policy_text: 'We accept cash payments.',
          no_show_fee_type: 'percent',
          no_show_fee_percent: 50.0,
          cancel_fee_type: 'percent',
          cancel_fee_percent: 50.0,
        },
        consent_at: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        consent_ip: '127.0.0.1',
        consent_user_agent: 'Mozilla/5.0 (Test)',
        source: 'public',
      };
    };

    const bookings = [
      // 3 pending bookings
      createBooking(0, 0, 0, 'pending', 2, 5000, 5000, 'card_saved', 'none'),
      createBooking(1, 1, 1, 'pending', 3, 15000, 12000, 'card_saved', 'none', 0), // Used gift card
      createBooking(2, 2, 0, 'pending', 4, 3500, 3500, 'card_saved', 'none'),
      // 3 completed bookings
      createBooking(3, 0, 0, 'completed', -5, 5000, 5000, 'charged', 'completed_charge'),
      createBooking(4, 1, 1, 'completed', -3, 15000, 15000, 'charged', 'completed_charge'),
      createBooking(5, 2, 0, 'completed', -1, 3500, 3500, 'charged', 'completed_charge'),
      // 2 no-show bookings
      createBooking(6, 0, 0, 'no_show', -2, 5000, 5000, 'charged', 'no_show_fee'),
      createBooking(7, 1, 1, 'no_show', -4, 15000, 15000, 'charged', 'no_show_fee'),
      // 2 cancelled bookings
      createBooking(8, 2, 0, 'cancelled', -6, 3500, 3500, 'charged', 'cancel_fee'),
      createBooking(9, 0, 0, 'cancelled', -7, 5000, 5000, 'none', 'none'), // No fee charged
      // 2 refunded bookings
      createBooking(0, 1, 1, 'refunded', -8, 15000, 15000, 'refunded', 'refund'),
      createBooking(1, 2, 0, 'refunded', -9, 3500, 3500, 'refunded', 'refund'),
      // 3 held bookings (expired)
      createBooking(2, 0, 0, 'held', 5, 5000, 5000, 'none', 'none'),
    ];

    const bookingIds: string[] = [];
    for (const booking of bookings) {
      const { data: newBooking, error } = await supabase
        .from('bookings')
        .insert({
          user_id: userId,
          business_id: businessId,
          ...booking,
        })
        .select('id')
        .single();

      if (error || !newBooking) {
        console.error(`Failed to create booking: ${error?.message}`);
        continue;
      }
      bookingIds.push(newBooking.id);
    }
    console.log(`   ✓ Created ${bookingIds.length} bookings`);

    // Step 13: Create booking payments for completed/no-show/cancelled bookings
    console.log('\n1️⃣3️⃣ Creating booking payments...');
    let paymentCount = 0;
    for (let i = 0; i < bookings.length; i++) {
      const booking = bookings[i];
      if (booking.status === 'completed' || booking.status === 'no_show' || 
          (booking.status === 'cancelled' && booking.payment_status === 'charged')) {
        const amount = booking.last_money_action === 'no_show_fee' 
          ? Math.round(booking.final_price_cents * 0.5) // 50% fee
          : booking.last_money_action === 'cancel_fee'
          ? Math.round(booking.final_price_cents * 0.5) // 50% fee
          : booking.final_price_cents;

        await supabase
          .from('booking_payments')
          .insert({
            user_id: userId,
            business_id: businessId,
            booking_id: bookingIds[i],
            stripe_payment_intent_id: `pi_test_${bookingIds[i].slice(0, 8)}`,
            amount_cents: amount,
            money_action: booking.last_money_action,
            status: booking.payment_status,
            application_fee_cents: Math.round(amount * 0.01), // 1% platform fee
            stripe_fee_cents: Math.round(amount * 0.029 + 30), // Stripe fee estimate
            net_amount_cents: amount - Math.round(amount * 0.01) - Math.round(amount * 0.029 + 30),
            currency: 'usd',
          });
        paymentCount++;
      } else if (booking.payment_status === 'card_saved') {
        // Create setup intent record for pending bookings
        await supabase
          .from('booking_payments')
          .insert({
            user_id: userId,
            business_id: businessId,
            booking_id: bookingIds[i],
            stripe_setup_intent_id: `seti_test_${bookingIds[i].slice(0, 8)}`,
            amount_cents: booking.final_price_cents,
            money_action: 'none',
            status: 'card_saved',
            currency: 'usd',
          });
        paymentCount++;
      }
    }
    console.log(`   ✓ Created ${paymentCount} booking payments`);

    console.log('\n✅ Seed completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   - Owner: ${DEMO_OWNER_EMAIL} / ${DEMO_OWNER_PASSWORD}`);
    console.log(`   - Business: ${DEMO_BUSINESS_NAME} (${DEMO_SUBDOMAIN}.tithi.com)`);
    console.log(`   - Categories: ${categoryIds.length}`);
    console.log(`   - Services: ${serviceIds.length}`);
    console.log(`   - Staff: ${staffIds.length}`);
    console.log(`   - Availability rules: ${ruleCount}`);
    console.log(`   - Gift cards: ${giftCardIds.length}`);
    console.log(`   - Notification templates: ${templates.length}`);
    console.log(`   - Customers: ${customerIds.length}`);
    console.log(`   - Bookings: ${bookingIds.length}`);
    console.log(`   - Payments: ${paymentCount}`);
    console.log('\n🔗 Login URL: http://localhost:3000/login');
    console.log(`   Email: ${DEMO_OWNER_EMAIL}`);
    console.log(`   Password: ${DEMO_OWNER_PASSWORD}`);
    console.log(`\n🔗 Booking URL: https://${DEMO_SUBDOMAIN}.tithi.com`);

  } catch (error) {
    console.error('\n❌ Seed failed:', error);
    if (error instanceof Error) {
      console.error('   Error message:', error.message);
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  }
}

// Run seed if called directly
if (require.main === module) {
  seed();
}

export { seed };

