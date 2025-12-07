const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  // Search for booking with code TTH-2025-1046
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, status, payment_status, created_at, booking_code')
    .ilike('booking_code', '%1046%')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('Bookings found:', bookings?.length || 0);
  bookings?.forEach(b => {
    console.log(`\nBooking: ${b.booking_code || b.id}`);
    console.log('  Status:', b.status);
    console.log('  Payment Status:', b.payment_status);
    console.log('  Created:', b.created_at);
  });

  // Also check recent bookings
  const { data: recent } = await supabase
    .from('bookings')
    .select('id, booking_code, status, payment_status')
    .order('created_at', { ascending: false })
    .limit(3);

  console.log('\n\nRecent bookings:');
  recent?.forEach(b => {
    console.log(`  ${b.booking_code || b.id} - ${b.status} (${b.payment_status})`);
  });
}
check();
