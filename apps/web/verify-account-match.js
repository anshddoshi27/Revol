const Stripe = require('stripe');
require('dotenv').config({ path: '.env' });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia',
});

async function verify() {
  const account = await stripe.accounts.retrieve();
  console.log('🔍 Your API Key is connected to:');
  console.log('   Account ID:', account.id);
  console.log('   Email:', account.email);
  console.log('   Type:', account.type);
  console.log('\n📋 You need to be in THIS account in the dashboard:');
  console.log(`   https://dashboard.stripe.com/test/acct_${account.id}/dashboard`);
  console.log('\n⚠️  If your dashboard shows a different account ID,');
  console.log('   you need to switch accounts in the dashboard.');
}
verify();
