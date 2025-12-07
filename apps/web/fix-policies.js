const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createPolicies() {
  // Get business
  const { data: business } = await supabase
    .from('businesses')
    .select('id, user_id, name')
    .eq('subdomain', 'demo')
    .single();

  if (!business) {
    console.log('❌ Business not found');
    return;
  }

  console.log(`✅ Business found: ${business.name}`);

  // Create policy (without cash_payment_policy_text which doesn't exist)
  const { data: policy, error } = await supabase
    .from('business_policies')
    .insert({
      user_id: business.user_id,
      business_id: business.id,
      version: 1,
      cancellation_policy_text: 'Cancellations must be made at least 24 hours in advance to receive a full refund. Cancellations made less than 24 hours before the appointment will incur a 50% cancellation fee.',
      no_show_policy_text: 'No-show appointments will be charged a 50% no-show fee based on the service price.',
      refund_policy_text: 'Refunds are available within 48 hours of service completion.',
      no_show_fee_type: 'percent',
      no_show_fee_amount_cents: 0,
      no_show_fee_percent: 50.0,
      cancel_fee_type: 'percent',
      cancel_fee_amount_cents: 0,
      cancel_fee_percent: 50.0,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    console.error('❌ Error creating policy:', error);
  } else {
    console.log('✅ Policy created successfully!');
    console.log(`   Policy ID: ${policy.id}`);
  }
}

createPolicies().catch(console.error);
