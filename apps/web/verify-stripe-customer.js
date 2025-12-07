const Stripe = require('stripe');
require('dotenv').config({ path: '.env' });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia',
});

async function verify() {
  try {
    // Check if customer exists
    const customerId = 'cus_TV7rDKa2OG5OoH';
    const customer = await stripe.customers.retrieve(customerId);
    console.log('✅ Customer exists:', customer.email);
  } catch (error) {
    console.log('❌ Customer not found in Stripe');
    console.log('   This means the customer was created in a different account');
    console.log('\n💡 Solution: Create a new booking - it will create a fresh customer');
  }

  // List recent customers
  console.log('\n📋 Recent customers in this Stripe account:');
  const customers = await stripe.customers.list({ limit: 5 });
  customers.data.forEach(c => {
    console.log(`   - ${c.id} (${c.email})`);
  });
}
verify();
