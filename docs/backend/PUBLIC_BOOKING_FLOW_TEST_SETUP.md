# Public Booking Flow Test - Setup Guide

## Prerequisites

Before running the test, you **MUST** set up test data in your database. The test requires a fully configured business with all the necessary data.

---

## Required Setup

### 1. Create a Business

You need a business with:

- **Subdomain**: Must match `TEST_SUBDOMAIN` environment variable (default: `test-business`)
- **Subscription Status**: Must be `'active'` or `'trial'` (NOT `null`, `'canceled'`, or `'paused'`)
- **Not Soft-Deleted**: `deleted_at` must be `NULL`

**SQL Example**:
```sql
INSERT INTO businesses (
  id, user_id, name, subdomain, timezone,
  subscription_status, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  'your-user-id-here',  -- Must be a valid auth.users.id
  'Test Business',
  'test-business',
  'America/New_York',
  'trial',  -- or 'active'
  now(),
  now()
);
```

---

### 2. Create Categories with Services

**SQL Example**:
```sql
-- Create a category
INSERT INTO service_categories (
  id, user_id, business_id, name, description, color,
  sort_order, is_active, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  'your-user-id-here',
  'your-business-id-here',
  'Hair Services',
  'All hair-related services',
  '#FF0000',
  0,
  true,
  now(),
  now()
);

-- Create a service
INSERT INTO services (
  id, user_id, business_id, category_id,
  name, description, duration_min, price_cents,
  pre_appointment_instructions, is_active,
  created_at, updated_at
) VALUES (
  gen_random_uuid(),
  'your-user-id-here',
  'your-business-id-here',
  'your-category-id-here',
  'Haircut',
  'Standard haircut service',
  60,  -- 60 minutes
  10000,  -- $100.00 in cents
  'Please arrive 10 minutes early',
  true,
  now(),
  now()
);
```

---

### 3. Create Staff

**SQL Example**:
```sql
INSERT INTO staff (
  id, user_id, business_id, name, role, color,
  is_active, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  'your-user-id-here',
  'your-business-id-here',
  'John Doe',
  'Stylist',
  '#00FF00',  -- Green for color-coding
  true,
  now(),
  now()
);
```

---

### 4. Assign Staff to Services

**SQL Example**:
```sql
INSERT INTO staff_services (
  id, user_id, business_id, staff_id, service_id, created_at
) VALUES (
  gen_random_uuid(),
  'your-user-id-here',
  'your-business-id-here',
  'your-staff-id-here',
  'your-service-id-here',
  now()
);
```

---

### 5. Create Availability Rules

**SQL Example**:
```sql
-- Create a weekly availability rule (Monday, 9am-5pm)
INSERT INTO availability_rules (
  id, user_id, business_id, staff_id, service_id,
  rule_type, weekday, start_time, end_time,
  capacity, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  'your-user-id-here',
  'your-business-id-here',
  'your-staff-id-here',
  'your-service-id-here',
  'weekly',
  1,  -- Monday (0=Sunday, 1=Monday, etc.)
  '09:00:00',
  '17:00:00',
  1,
  now(),
  now()
);
```

---

### 6. Create Business Policies (Required for Booking Creation)

**SQL Example**:
```sql
INSERT INTO business_policies (
  id, user_id, business_id, version,
  cancellation_policy_text,
  no_show_policy_text,
  refund_policy_text,
  cash_payment_policy_text,
  no_show_fee_type, no_show_fee_amount_cents, no_show_fee_percent,
  cancel_fee_type, cancel_fee_amount_cents, cancel_fee_percent,
  is_active, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  'your-user-id-here',
  'your-business-id-here',
  1,
  'Cancellations must be made 24 hours in advance.',
  'No-show fee is 50% of service price.',
  'Refunds available within 48 hours.',
  'Cash payments accepted.',
  'percent',  -- or 'amount'
  0,  -- amount_cents (if type is 'amount')
  50,  -- percent (if type is 'percent')
  'percent',
  0,
  25,
  true,
  now(),
  now()
);
```

---

## Quick Setup Using Supabase Dashboard

### Option 1: Use the Onboarding Flow

The easiest way is to:

1. Sign up / log in to your app
2. Complete the onboarding flow
3. Set `subscription_status = 'trial'` or `'active'` in Supabase dashboard
4. Use the subdomain you created during onboarding for `TEST_SUBDOMAIN`

### Option 2: Manual Setup via Supabase Dashboard

1. **Go to Supabase Dashboard** → Your Project → Table Editor

2. **Create Business**:
   - Go to `businesses` table
   - Click "Insert row"
   - Fill in:
     - `subdomain`: `test-business` (or your preferred subdomain)
     - `subscription_status`: `trial` or `active`
     - `name`: Your business name
     - `timezone`: `America/New_York` (or your timezone)
     - `user_id`: A valid auth.users.id

3. **Create Category**:
   - Go to `service_categories` table
   - Create a category linked to your business

4. **Create Service**:
   - Go to `services` table
   - Create a service linked to your category
   - Set `duration_min` (e.g., 60 for 60 minutes)
   - Set `price_cents` (e.g., 10000 for $100.00)

5. **Create Staff**:
   - Go to `staff` table
   - Create staff member linked to your business
   - Set `role` and `color` (for color-coding)

6. **Link Staff to Service**:
   - Go to `staff_services` table
   - Link staff to service

7. **Create Availability Rules**:
   - Go to `availability_rules` table
   - Create weekly rules for staff/service combination
   - Set `weekday` (0=Sunday, 1=Monday, etc.)
   - Set `start_time` and `end_time`

8. **Create Policies**:
   - Go to `business_policies` table
   - Create policies linked to your business
   - Set `is_active = true`

---

## Verify Setup

### Check Business Exists and Has Correct Status

```sql
SELECT id, name, subdomain, subscription_status, deleted_at
FROM businesses
WHERE subdomain = 'test-business';
```

**Expected**:
- One row returned
- `subscription_status` is `'active'` or `'trial'`
- `deleted_at` is `NULL`

### Check Services and Staff Are Set Up

```sql
-- Check services
SELECT s.id, s.name, s.duration_min, s.price_cents, c.name as category_name
FROM services s
JOIN service_categories c ON s.category_id = c.id
WHERE s.business_id = 'your-business-id-here'
AND s.is_active = true;

-- Check staff
SELECT id, name, role, color
FROM staff
WHERE business_id = 'your-business-id-here'
AND is_active = true;

-- Check staff-service links
SELECT ss.id, s.name as service_name, st.name as staff_name
FROM staff_services ss
JOIN services s ON ss.service_id = s.id
JOIN staff st ON ss.staff_id = st.id
WHERE ss.business_id = 'your-business-id-here';
```

### Check Availability Rules

```sql
SELECT ar.id, s.name as service_name, st.name as staff_name,
       ar.weekday, ar.start_time, ar.end_time, ar.rule_type
FROM availability_rules ar
JOIN services s ON ar.service_id = s.id
JOIN staff st ON ar.staff_id = st.id
WHERE ar.business_id = 'your-business-id-here'
AND ar.deleted_at IS NULL;
```

---

## Environment Variables

Make sure your `.env.local` has:

```bash
NEXT_PUBLIC_BASE_URL=http://localhost:3000
TEST_SUBDOMAIN=test-business  # Must match your business subdomain
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
STRIPE_SECRET_KEY=your-stripe-key  # Optional for some tests
```

---

## Running the Test

After setup is complete:

```bash
cd apps/web
npm run test:public-booking-complete
```

---

## Common Issues

### Issue: "Business not found"

**Cause**: No business exists with the specified subdomain, or subscription_status is not 'active'/'trial'

**Solution**:
1. Check that business exists: `SELECT * FROM businesses WHERE subdomain = 'test-business';`
2. Update subscription_status: `UPDATE businesses SET subscription_status = 'trial' WHERE subdomain = 'test-business';`

### Issue: "No slots found" (Step 2 fails)

**Cause**: No availability rules configured, or staff not assigned to service

**Solution**:
1. Ensure staff-service link exists: `SELECT * FROM staff_services WHERE business_id = '...';`
2. Ensure availability rules exist: `SELECT * FROM availability_rules WHERE business_id = '...';`
3. Check that weekday matches the test date

### Issue: "Booking creation fails" (Step 4 fails)

**Cause**: Missing business policies

**Solution**:
1. Create business_policies row: `INSERT INTO business_policies (...);`
2. Ensure `is_active = true`

---

## Summary

Before running the test, you **MUST** have:

✅ Business with subdomain matching `TEST_SUBDOMAIN`  
✅ Business `subscription_status = 'active'` or `'trial'`  
✅ At least one category  
✅ At least one service (with duration, price, instructions)  
✅ At least one staff member (with role, color)  
✅ Staff linked to service (`staff_services`)  
✅ Availability rules for staff/service/weekday  
✅ Business policies configured (`business_policies`)  

Once all of these are set up, the test will pass!


