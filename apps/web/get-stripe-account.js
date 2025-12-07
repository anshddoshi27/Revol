const Stripe = require('stripe');
require('dotenv').config({ path: '.env' });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia',
});

async function getAccount() {
  const account = await stripe.accounts.retrieve();
  console.log('Stripe Account:');
  console.log('  ID:', account.id);
  console.log('  Email:', account.email);
  console.log('\nDirect customer link:');
  console.log(`https://dashboard.stripe.com/test/acct_${account.id}/customers/cus_TV7rDKa2OG5OoH`);
}
getAccount();
