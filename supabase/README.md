# Supabase Migrations

This directory contains database migration files for Tithi.

## Running Migrations

### Option 1: Using Supabase Dashboard (Recommended for first time)

1. Go to your Supabase project: https://app.supabase.com
2. Navigate to **SQL Editor**
3. Open the migration file: `migrations/20250101000000_initial_schema.sql`
4. Copy the entire contents
5. Paste into the SQL Editor
6. Click **Run** (or press Cmd/Ctrl + Enter)
7. Wait for it to complete (should take 10-30 seconds)

### Option 2: Using Supabase CLI

If you have the Supabase CLI installed:

```bash
# Install Supabase CLI (if not installed)
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

### Option 3: Using psql (Direct PostgreSQL connection)

If you have direct database access:

```bash
# Get your connection string from Supabase Dashboard > Settings > Database
# Format: postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres

psql "your-connection-string" -f migrations/20250101000000_initial_schema.sql
```

## Verifying the Migration

After running the migration, verify it worked:

1. **Via Supabase Dashboard:**
   - Go to **Table Editor**
   - You should see all tables: `businesses`, `services`, `bookings`, etc.

2. **Via Test Endpoint:**
   - Visit: `http://localhost:3000/api/test-db`
   - Should now show: `"tablesExist": true`

3. **Via SQL Query:**
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   ORDER BY table_name;
   ```
   Should list all 18+ tables.

## What This Migration Creates

- **8 ENUM types**: booking_status, payment_status, money_action, etc.
- **18 tables**: businesses, services, bookings, payments, etc.
- **30+ indexes**: For performance and uniqueness constraints
- **RLS policies**: Row-level security for all tenant tables
- **Triggers**: Auto-update `updated_at` timestamps

## Troubleshooting

### Error: "relation already exists"
- Tables already exist - you may have run this migration before
- Either drop existing tables or skip this migration

### Error: "permission denied"
- Make sure you're using the service role key or have proper permissions
- Check that you're connected to the correct database

### Error: "type already exists"
- ENUM types already exist - this is okay, the migration will skip creating them
- Or manually drop them first: `DROP TYPE IF EXISTS booking_status CASCADE;`

### Connection Issues
- Verify your `.env.local` has correct Supabase keys
- Check that your Supabase project is active (not paused)

## Next Steps

After running the migration:

1. ✅ Test the connection: `http://localhost:3000/api/test-db`
2. ✅ Verify tables exist in Supabase Dashboard
3. ✅ Proceed to Task 4: Implement onboarding API routes




