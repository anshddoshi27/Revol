const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, status, payment_status')
    .eq('id', '68ddacae-e485-41a9-8c33-b9f9b9662993')
    .single();

  console.log('Booking:', booking);

  const { data: payments } = await supabase
    .from('booking_payments')
    .select('*')
    .eq('booking_id', '68ddacae-e485-41a9-8c33-b9f9b9662993');

  console.log('Payments:', payments);
}

check();
