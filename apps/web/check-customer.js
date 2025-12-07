const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  // Check the booking
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, customer_id, created_at')
    .eq('id', '3f1d1f04-291a-40c7-81a1-f8f3986993f5')
    .single();

  if (!booking) {
    console.log('Booking not found');
    return;
  }

  console.log('Booking:', booking.id);
  console.log('Customer ID:', booking.customer_id);

  // Check customer
  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('id', booking.customer_id)
    .single();

  console.log('\nCustomer:');
  console.log('  ID:', customer?.id);
  console.log('  Email:', customer?.email);
  console.log('  Stripe Customer ID:', customer?.stripe_customer_id);
  console.log('  Created:', customer?.created_at);
}
check();
