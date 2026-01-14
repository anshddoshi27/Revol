import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.join(__dirname, '../.env') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function checkBusiness() {
  const { data, error } = await supabase
    .from('businesses')
    .select('id, name, subdomain, subscription_status')
    .eq('subdomain', 'test-business')
    .single();
  
  console.log('Business data:', JSON.stringify(data, null, 2));
  if (error) console.log('Error:', error);
}

checkBusiness();

