const Stripe = require('stripe');
require('dotenv').config({ path: '.env' });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia',
});

async function verify() {
  try {
    // Get account info
    const account = await stripe.accounts.retrieve();
    console.log('✅ Your API Key is connected to:');
    console.log('   Account ID:', account.id);
    console.log('   Email:', account.email);
    console.log('   Display Name:', account.settings?.dashboard?.display_name || 'Not set');
    console.log('   Type:', account.type);
    
    // Check if customer exists
    console.log('\n🔍 Checking for customer: cus_TV7rDKa2OG5OoH');
    try {
      const customer = await stripe.customers.retrieve('cus_TV7rDKa2OG5OoH');
      console.log('✅ Customer found in this account!');
      console.log('   Email:', customer.email);
      console.log('   Created:', new Date(customer.created * 1000).toISOString());
    } catch (error) {
      console.log('❌ Customer NOT found in this account');
      console.log('   Error:', error.message);
    }
    
    // List all accounts if possible
    console.log('\n📋 Account Summary:');
    console.log('   If "Booking 4" shows account ID:', account.id);
    console.log('   Then you\'re in the correct account!');
    console.log('\n💡 To verify: Check the account ID in your dashboard URL');
    console.log('   Should match:', account.id);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}
verify();
