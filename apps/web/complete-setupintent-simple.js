const Stripe = require('stripe');
require('dotenv').config({ path: '.env' });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia',
});

async function completeSetupIntent(setupIntentId) {
  try {
    console.log(`Retrieving SetupIntent: ${setupIntentId}...`);
    const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
    
    console.log(`Status: ${setupIntent.status}`);
    console.log(`Customer: ${setupIntent.customer}`);
    
    if (setupIntent.status === 'succeeded') {
      console.log('✅ SetupIntent already succeeded!');
      return true;
    }
    
    if (setupIntent.status === 'requires_payment_method') {
      console.log('\n⚠️  SetupIntent requires payment method');
      console.log('Creating test payment method...');
      
      // Create a test payment method using Stripe's test token
      // For test mode, we can use a payment method token
      try {
        // Attach a test payment method to the customer
        const paymentMethod = await stripe.paymentMethods.create({
          type: 'card',
          card: {
            number: '4242424242424242',
            exp_month: 12,
            exp_year: 2025,
            cvc: '123',
          },
        });
        
        // Attach to customer
        await stripe.paymentMethods.attach(paymentMethod.id, {
          customer: setupIntent.customer,
        });
        
        // Confirm the SetupIntent
        const confirmed = await stripe.setupIntents.confirm(setupIntentId, {
          payment_method: paymentMethod.id,
        });
        
        console.log('✅ SetupIntent confirmed!');
        console.log(`Payment Method: ${paymentMethod.id}`);
        console.log(`Status: ${confirmed.status}`);
        return true;
      } catch (error) {
        console.error('❌ Error:', error.message);
        console.log('\n💡 Alternative: Use Stripe Dashboard or complete booking directly');
        return false;
      }
    }
    
    return false;
  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

// Get SetupIntent ID from command line or use the latest one
const setupIntentId = process.argv[2] || 'seti_1SY7c7RtjyTFPgioRqqmbw82';

completeSetupIntent(setupIntentId).then(success => {
  if (success) {
    console.log('\n✅ SetupIntent is ready!');
    console.log('Now you can complete the booking in the admin panel.');
  } else {
    console.log('\n⚠️  SetupIntent not confirmed, but you can still try completing the booking.');
  }
});
