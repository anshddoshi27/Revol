const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPolicies() {
  // Get business ID
  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, subdomain')
    .eq('subdomain', 'demo')
    .single();

  if (!business) {
    console.log('❌ Business not found');
    return;
  }

  console.log(`✅ Business found: ${business.name} (${business.id})`);

  // Check policies
  const { data: policies, error } = await supabase
    .from('business_policies')
    .select('*')
    .eq('business_id', business.id);

  console.log(`\nPolicies found: ${policies?.length || 0}`);
  
  if (policies && policies.length > 0) {
    policies.forEach(p => {
      console.log(`  - ID: ${p.id}, Active: ${p.is_active}, Version: ${p.version}`);
    });
  } else {
    console.log('❌ No policies found for this business');
  }

  // Check active policies
  const { data: activePolicy } = await supabase
    .from('business_policies')
    .select('*')
    .eq('business_id', business.id)
    .eq('is_active', true)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activePolicy) {
    console.log(`\n✅ Active policy found: Version ${activePolicy.version}`);
  } else {
    console.log('\n❌ No active policy found');
  }
}

checkPolicies().catch(console.error);
