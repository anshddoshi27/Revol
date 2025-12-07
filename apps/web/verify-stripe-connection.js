const Stripe = require('stripe');
require('dotenv').config({ path: '.env' });

const stripeKey = process.env.STRIPE_SECRET_KEY || 'sk_test_51SLrw1RtjyTFPgioGGVLGRUFkK58BWp5uIByjzbD9um8JhYrf4APqDSLSQ7lQmVG3oiFT9muyRMBaU4BIuhdBP1Z004j4Ke6v4';

const stripe = new Stripe(stripeKey, {
  apiVersion: '2024-11-20.acacia',
});

async function verify() {
  try {
    // Get account info
    const account = await stripe.accounts.retrieve();
    console.log('✅ Connected to Stripe account:');
    console.log('   Account ID:', account.id);
    console.log('   Email:', account.email);
    console.log('   Type:', account.type);
    console.log('   Country:', account.country);
    
    // Try to retrieve the SetupIntent
    const setupIntentId = 'seti_1SY7c7RtjyTFPgioRqqmbw82';
    try {
      const si = await stripe.setupIntents.retrieve(setupIntentId);
      console.log('\n✅ SetupIntent found:');
      console.log('   ID:', si.id);
      console.log('   Status:', si.status);
      console.log('   Customer:', si.customer);
      console.log('   Created:', new Date(si.created * 1000).toISOString());
    } catch (error) {
      console.log('\n❌ SetupIntent not found in this account');
      console.log('   Error:', error.message);
    }
    
    // List recent SetupIntents
    console.log('\n📋 Recent SetupIntents in this account:');
    const recent = await stripe.setupIntents.list({ limit: 5 });
    if (recent.data.length > 0) {
      recent.data.forEach(si => {
        console.log(`   - ${si.id} (${si.status}) - ${new Date(si.created * 1000).toISOString()}`);
      });
    } else {
      console.log('   No SetupIntents found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

verify();
