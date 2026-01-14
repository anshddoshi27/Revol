// Admin script to create subscription for DAMBOX account
// Run: node scripts/create-dambox-subscription.js

require('dotenv').config({ path: '.env.local' });
const Stripe = require('stripe');

const BUSINESS_ID = 'c5bb33ab-d767-44db-a239-68d65f19ecf1'; // DAMBOX
const USER_EMAIL = 'johny@gmail.com';
const CONNECT_ACCOUNT_ID = 'acct_1SamCw2KHPPJV1hT';

// You'll need to set these - or connect to your database
// This is a template - you may need to adjust based on your setup

async function createSubscription() {
  console.log('Creating subscription for DAMBOX account...');
  
  // Check environment variables
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PLAN_PRICE_ID_WITH_NOTIFICATIONS;
  
  if (!stripeSecretKey) {
    console.error('❌ STRIPE_SECRET_KEY not set in .env.local');
    return;
  }
  
  if (!priceId) {
    console.error('❌ STRIPE_PLAN_PRICE_ID_WITH_NOTIFICATIONS not set in .env.local');
    return;
  }
  
  const stripe = new Stripe(stripeSecretKey);
  
  try {
    // Verify Connect account
    const account = await stripe.accounts.retrieve(CONNECT_ACCOUNT_ID);
    console.log('✅ Connect account found:', account.email || CONNECT_ACCOUNT_ID);
    
    if (!account.charges_enabled) {
      console.warn('⚠️ Connect account charges not enabled - may need to complete onboarding');
    }
    
    // Create or get customer
    const customers = await stripe.customers.list({
      email: USER_EMAIL,
      limit: 1,
    });
    
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      console.log('✅ Using existing customer:', customerId);
    } else {
      const customer = await stripe.customers.create({
        email: USER_EMAIL,
        name: 'DAMBOX',
        metadata: {
          business_id: BUSINESS_ID,
        },
      });
      customerId = customer.id;
      console.log('✅ Customer created:', customerId);
    }
    
    // Create subscription
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      trial_period_days: 7,
      metadata: {
        business_id: BUSINESS_ID,
        user_email: USER_EMAIL,
      },
    });
    
    console.log('✅ Subscription created:', subscription.id);
    console.log('   Status:', subscription.status);
    console.log('   Trial end:', new Date(subscription.trial_end * 1000).toISOString());
    
    // Now you need to update your database manually
    console.log('\n📝 Database Update Required:');
    console.log('Run this SQL query to update your database:');
    console.log('');
    console.log(`UPDATE businesses SET`);
    console.log(`  stripe_customer_id = '${customerId}',`);
    console.log(`  stripe_subscription_id = '${subscription.id}',`);
    console.log(`  stripe_price_id = '${priceId}',`);
    console.log(`  subscription_status = 'trial',`);
    console.log(`  trial_ends_at = '${new Date(subscription.trial_end * 1000).toISOString()}',`);
    console.log(`  next_bill_at = '${new Date(subscription.trial_end * 1000).toISOString()}',`);
    console.log(`  updated_at = now()`);
    console.log(`WHERE id = '${BUSINESS_ID}';`);
    console.log('');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.type === 'StripeInvalidRequestError') {
      console.error('   Details:', error.raw?.message);
    }
  }
}

createSubscription()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });


