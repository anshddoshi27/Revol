import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.join(__dirname, '../.env') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const BUSINESS_ID = '5c860b65-0710-4238-a92c-ea9b1da6d984';
const SERVICE_ID = 'ed9bd9a5-81ca-473f-bc18-cc563b08c976';

async function checkSetup() {
  console.log('🔍 Checking availability setup...\n');
  
  // Check service
  const { data: service } = await supabase
    .from('services')
    .select('id, name, duration_min')
    .eq('id', SERVICE_ID)
    .single();
  
  console.log('Service:', service ? `✓ ${service.name} (${service.duration_min} min)` : '✗ Not found');
  
  // Check staff
  const { data: staff } = await supabase
    .from('staff')
    .select('id, name')
    .eq('business_id', BUSINESS_ID)
    .is('deleted_at', null);
  
  console.log('Staff:', staff && staff.length > 0 ? `✓ ${staff.length} staff member(s)` : '✗ No staff found');
  if (staff && staff.length > 0) {
    console.log('   Staff IDs:', staff.map(s => s.id).join(', '));
  }
  
  // Check staff-service associations
  const { data: staffServices } = await supabase
    .from('staff_services')
    .select('staff_id, service_id')
    .eq('service_id', SERVICE_ID)
    .eq('business_id', BUSINESS_ID);
  
  console.log('Staff-Service Links:', staffServices && staffServices.length > 0 ? `✓ ${staffServices.length} link(s)` : '✗ No links found');
  if (staffServices && staffServices.length > 0) {
    console.log('   Links:', staffServices.map(ss => `staff:${ss.staff_id} -> service:${ss.service_id}`).join(', '));
  }
  
  // Check availability rules
  let rules: any[] = [];
  const staffIds = staff?.map(s => s.id) || [];
  if (staffIds.length > 0) {
    const { data: rulesData } = await supabase
      .from('availability_rules')
      .select('id, staff_id, weekday, start_time, end_time')
      .eq('business_id', BUSINESS_ID)
      .in('staff_id', staffIds)
      .is('deleted_at', null);
    
    rules = rulesData || [];
    console.log('Availability Rules:', rules.length > 0 ? `✓ ${rules.length} rule(s)` : '✗ No rules found');
    if (rules.length > 0) {
      rules.forEach(rule => {
        const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        console.log(`   - ${weekdayNames[rule.weekday]}: ${rule.start_time} - ${rule.end_time} (staff: ${rule.staff_id})`);
      });
    }
  }
  
  console.log('\n📋 Summary:');
  if (!service) {
    console.log('❌ Service not found');
  } else if (!staff || staff.length === 0) {
    console.log('❌ No staff members');
  } else if (!staffServices || staffServices.length === 0) {
    console.log('❌ No staff-service links (staff must be assigned to service)');
  } else if (rules.length === 0) {
    console.log('❌ No availability rules (need rules for staff to generate slots)');
  } else {
    console.log('✅ All setup looks good!');
  }
}

checkSetup();

