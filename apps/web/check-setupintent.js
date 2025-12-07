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
    .select('id, status, created_at')
    .eq('id', '32f97920-fdff-4a97-b2ee-5bcf9fab8258')
    .single();

  console.log('Booking:', booking);
  console.log('Created:', booking?.created_at);
  console.log('Age:', booking ? Math.round((Date.now() - new Date(booking.created_at).getTime()) / 1000 / 60) + ' minutes' : 'N/A');

  // Check payment record
  const { data: payment } = await supabase
    .from('booking_payments')
    .select('*')
    .eq('booking_id', '32f97920-fdff-4a97-b2ee-5bcf9fab8258')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  console.log('\nPayment record:');
  console.log('SetupIntent ID:', payment?.stripe_setup_intent_id);
  console.log('Status:', payment?.status);
}
check();
