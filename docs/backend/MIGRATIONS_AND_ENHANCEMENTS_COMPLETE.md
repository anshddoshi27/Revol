# Migrations and Enhancements Complete

**Date:** 2025-01-XX  
**Status:** ✅ All Implemented

---

## Summary

All identified gaps from the comprehensive database review have been addressed:

1. ✅ **Configurable Lead Time & Max Advance Days** - Migration created and code updated
2. ✅ **Social Media Fields** - Migration created
3. ✅ **${staff.name} Placeholder Support** - Implemented in notifications

---

## 1. Configurable Availability Settings

### Migration: `20250101000004_add_availability_settings.sql`

**Added Columns to `businesses` table:**
- `min_lead_time_minutes` (integer, default: 120)
- `max_advance_days` (integer, default: 60)

**Features:**
- Default values match previous hardcoded values (2 hours, 60 days)
- Check constraints ensure positive values
- Comments added for clarity

### Code Updates

**`apps/web/src/lib/availability.ts`:**
- Updated to read `min_lead_time_minutes` and `max_advance_days` from database
- Falls back to defaults if not set
- Removed comment about columns not existing

**`apps/web/src/app/api/public/[slug]/availability/route.ts`:**
- Updated to fetch `min_lead_time_minutes` and `max_advance_days` from business
- Passes these values to `generateAvailabilitySlots()`

**Impact:**
- Businesses can now customize lead time and booking window per business
- Maintains backward compatibility with defaults
- No breaking changes

---

## 2. Social Media Fields

### Migration: `20250101000005_add_social_media_fields.sql`

**Added Columns to `businesses` table:**
- `instagram_url` (text, nullable)
- `facebook_url` (text, nullable)
- `tiktok_url` (text, nullable)
- `youtube_url` (text, nullable)

**Features:**
- All fields are optional (nullable)
- Comments added for clarity
- Ready for frontend integration in onboarding step 3 (Location & Contacts)

**Next Steps (Frontend):**
- Add input fields in onboarding location step
- Display on public booking site (optional)
- Add to admin settings page

---

## 3. ${staff.name} Placeholder Support

### Code Updates

**`apps/web/src/lib/notifications.ts`:**
1. **Added `staff` to `NotificationData` interface:**
   ```typescript
   interface NotificationData {
     // ... existing fields
     staff?: any;
   }
   ```

2. **Added placeholder replacement:**
   ```typescript
   if (data.staff) {
     rendered = rendered.replace(/\${staff\.name}/g, data.staff.name || '');
   }
   ```

3. **Auto-fetch staff data:**
   - If `staff` is missing but `booking.staff_id` exists, automatically fetches staff data
   - Ensures placeholder works even if staff data not provided

**`apps/web/src/components/onboarding/constants.ts`:**
- Added `"${staff.name}"` to `PLACEHOLDER_TOKENS` array
- Now available in onboarding notification template editor

**`apps/web/src/app/app/b/[businessId]/notifications/page.tsx`:**
- Added `"${staff.name}"` to `PLACEHOLDERS` array
- Added preview replacement: `"${staff.name}"` → `"Ava Thompson"`

**Impact:**
- Notification templates can now include staff name
- Placeholder is validated in UI (won't show as "unknown")
- Preview shows sample staff name
- Auto-fetches staff data when needed

---

## Migration Instructions

### To Apply Migrations:

1. **Using Supabase CLI:**
   ```bash
   supabase migration up
   ```

2. **Or manually in Supabase Dashboard:**
   - Go to SQL Editor
   - Run `20250101000004_add_availability_settings.sql`
   - Run `20250101000005_add_social_media_fields.sql`

### Verification:

After applying migrations, verify:

```sql
-- Check availability settings columns exist
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'businesses'
  AND column_name IN ('min_lead_time_minutes', 'max_advance_days');

-- Check social media columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'businesses'
  AND column_name IN ('instagram_url', 'facebook_url', 'tiktok_url', 'youtube_url');
```

---

## Testing Checklist

### Availability Settings
- [ ] Test with default values (should work as before)
- [ ] Test with custom `min_lead_time_minutes` (e.g., 60 minutes)
- [ ] Test with custom `max_advance_days` (e.g., 30 days)
- [ ] Verify slots respect custom settings

### Social Media Fields
- [ ] Verify columns exist in database
- [ ] Test saving social media URLs in onboarding (when frontend updated)
- [ ] Test displaying on public booking site (when frontend updated)

### Staff Name Placeholder
- [ ] Create notification template with `${staff.name}`
- [ ] Verify placeholder is available in onboarding UI
- [ ] Verify placeholder is available in admin notifications UI
- [ ] Test notification preview shows staff name
- [ ] Test actual notification sent includes staff name
- [ ] Verify auto-fetch works when staff data not provided

---

## Files Modified

### Migrations
- ✅ `supabase/migrations/20250101000004_add_availability_settings.sql` (new)
- ✅ `supabase/migrations/20250101000005_add_social_media_fields.sql` (new)

### Backend Code
- ✅ `apps/web/src/lib/availability.ts`
- ✅ `apps/web/src/app/api/public/[slug]/availability/route.ts`
- ✅ `apps/web/src/lib/notifications.ts`

### Frontend Code
- ✅ `apps/web/src/components/onboarding/constants.ts`
- ✅ `apps/web/src/app/app/b/[businessId]/notifications/page.tsx`

---

## Status: ✅ Complete

All identified gaps have been addressed:
- ✅ Configurable availability settings (migration + code)
- ✅ Social media fields (migration)
- ✅ Staff name placeholder (code + UI)

**The database and backend are now 100% complete per frontend logistics requirements.**

