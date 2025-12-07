const Stripe = require('stripe');
require('dotenv').config({ path: '.env' });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia',
});

async function addPaymentMethod() {
  const customerId = 'cus_TV7rDKa2OG5OoH';
  
  try {
    // Verify customer exists
    const customer = await stripe.customers.retrieve(customerId);
    console.log('✅ Customer found:', customer.email);
    
    // Check existing payment methods
    const existing = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });
    
    if (existing.data.length > 0) {
      console.log('\n✅ Customer already has payment methods:');
      existing.data.forEach(pm => {
        console.log(`   - ${pm.id} (${pm.card?.brand} ending in ${pm.card?.last4})`);
      });
      console.log('\n✅ You can complete the booking now!');
      return;
    }
    
    console.log('\n⚠️  No payment methods found');
    console.log('\n📋 To add a payment method:');
    console.log('1. Go to Stripe Dashboard');
    console.log(`2. Navigate to: Customers → ${customer.email}`);
    console.log('3. Click "Add payment method"');
    console.log('4. Use test card: 4242 4242 4242 4242');
    console.log('\nOr use this direct link (with your account ID):');
    console.log(`https://dashboard.stripe.com/test/customers/${customerId}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}
addPaymentMethod();
