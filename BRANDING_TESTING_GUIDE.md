# Branding Step Testing Guide

This guide will help you test all the new branding customization features added to Step 5 of the onboarding flow.

## Prerequisites

1. **Run the database migration**:
   ```bash
   # Make sure the migration has been applied
   # The migration file is: supabase/migrations/20250106000000_add_branding_columns.sql
   ```

2. **Start your development server**:
   ```bash
   npm run dev
   ```

## Testing Steps

### 1. Access the Branding Step

1. Navigate to `/onboarding` in your browser
2. Complete steps 1-4 (Business, Website, Location, Team)
3. You should now be on **Step 5: Branding**

### 2. Test Primary & Secondary Colors

**Test Primary Color:**
- Click the primary color picker
- Select different colors (try: `#FF0000`, `#00FF00`, `#0000FF`)
- **Expected**: 
  - Color picker updates
  - Preview shows the color in:
    - Business name text
    - "Book Now" button
    - Color accent indicators
    - Button borders and highlights

**Test Secondary Color:**
- Click the secondary color picker
- Select different colors (try: `#000000`, `#1a1a2e`, `#2d2d44`)
- **Expected**:
  - Color picker updates
  - Preview background changes to show the secondary color
  - Gradient uses both primary and secondary colors

### 3. Test Font Family Selection

**Test Font Changes:**
1. Click the "Font Family" dropdown
2. Select each font one by one:
   - Inter
   - Poppins
   - Playfair Display
   - Montserrat
   - Lora
   - Roboto
   - Open Sans
   - Raleway
   - Merriweather
   - DM Sans

**Expected Behavior:**
- ✅ Dropdown shows all 10 fonts
- ✅ Selected font is highlighted with a checkmark
- ✅ **Preview updates immediately** showing the new font in:
  - Business name
  - Description text
  - "Sample Service" label
  - "Haircut & Style" service name
  - "45 min · $65" service details
  - "Theme colors" text
- ✅ Fonts load from Google Fonts (may take 1-2 seconds on first load)

**If fonts don't change:**
- Check browser console for font loading errors
- Verify internet connection (fonts load from Google Fonts)
- Try hard refresh (Cmd+Shift+R or Ctrl+Shift+R)

### 4. Test Button Shape Selection

**Test Button Shapes:**
1. Click each button shape option:
   - **Rounded** (should be `rounded-full`)
   - **Slightly Rounded** (should be `rounded-lg`)
   - **Square** (should be `rounded-none`)

**Expected:**
- Selected button is highlighted
- Preview "Book Now" button updates immediately
- Button corners change shape according to selection

### 5. Test Logo Upload

**Test Logo Upload:**
1. Click the logo upload area
2. Upload a square image (recommended: 200×200px)
3. **Valid formats**: PNG, JPG, WEBP, SVG
4. **Size limits**: 50×50px minimum, 400×400px maximum, 2MB max

**Expected:**
- ✅ Square images are accepted
- ✅ Logo appears in top-right of preview
- ✅ Logo is properly sized (56×56px in preview)
- ✅ Error messages show for:
  - Non-square images
  - Images too small (< 50×50px)
  - Images too large (> 2MB)
  - Invalid file formats

**Test Logo Removal:**
- Click "Remove logo" button
- Logo should disappear from preview

### 6. Test Hero Image Upload

**Test Hero Image Upload:**
1. Click the hero image upload area
2. Upload a landscape image (recommended: 1200×400px)
3. **Valid formats**: PNG, JPG, WEBP
4. **Size limits**: 800×300px minimum, 5MB max

**Expected:**
- ✅ Hero image appears as background in preview
- ✅ Image has opacity overlay
- ✅ Gradient fallback when no hero image
- ✅ Error messages for invalid images

**Test Hero Image Removal:**
- Click "Remove hero image" button
- Preview should show gradient background instead

### 7. Test Booking Page Description

**Test Description:**
1. Type text in the description textarea
2. **Max length**: 300 characters
3. Character counter should update: `(X/300)`

**Expected:**
- ✅ Description appears under business name in preview
- ✅ Character counter updates in real-time
- ✅ Text is limited to 300 characters
- ✅ Description is optional (can be empty)

### 8. Test Live Preview

**Verify Preview Updates:**
- All changes should reflect **immediately** in the preview panel
- Preview should show:
  - Business name with selected font and primary color
  - Description text (if provided)
  - Logo in top-right (if uploaded)
  - Hero image or gradient background
  - Sample service card with correct button shape
  - Color accent indicators

### 9. Test Data Persistence

**Test Saving:**
1. Fill in all branding fields
2. Click "Continue" to go to next step
3. Navigate back to branding step (or refresh page)

**Expected:**
- ✅ All selections are preserved:
  - Primary color
  - Secondary color
  - Font family
  - Button shape
  - Logo (if uploaded)
  - Hero image (if uploaded)
  - Description text

### 10. Test on Public Booking Page

**After completing onboarding:**
1. Go to the public booking page: `/public/{your-subdomain}`
2. Verify all branding is applied:
   - ✅ Font family is used throughout
   - ✅ Primary color for buttons and accents
   - ✅ Secondary color for backgrounds
   - ✅ Logo appears in top-right
   - ✅ Hero image or gradient background
   - ✅ Button shapes match selection
   - ✅ Description appears under business name

**Test Responsiveness:**
- ✅ Mobile view (< 640px)
- ✅ Tablet view (640px - 1024px)
- ✅ Desktop view (> 1024px)
- Logo should be properly sized on all devices
- Hero image should scale appropriately

### 11. Test Database Storage

**Verify Database:**
```sql
-- Check branding columns in businesses table
SELECT 
  brand_primary_color,
  brand_secondary_color,
  brand_font_family,
  brand_button_shape,
  logo_url,
  hero_image_url,
  booking_page_description
FROM businesses
WHERE subdomain = 'your-test-subdomain';
```

**Expected:**
- All fields should be populated with your selections
- Colors should be hex codes (e.g., `#5B64FF`)
- Font family should be one of the 10 valid options
- Button shape should be: `rounded`, `slightly-rounded`, or `square`

## Common Issues & Solutions

### Fonts Not Changing in Preview

**Issue**: Fonts don't update when selected

**Solutions:**
1. Check browser console for errors
2. Verify Google Fonts are loading (check Network tab)
3. Hard refresh the page (Cmd+Shift+R)
4. Check that font family is applied to preview container (inspect element)

### Logo Not Appearing

**Issue**: Logo uploads but doesn't show

**Solutions:**
1. Verify image is square (ratio between 0.8-1.2)
2. Check image size (50×50px minimum)
3. Verify file format (PNG, JPG, WEBP, SVG)
4. Check browser console for image loading errors

### Colors Not Updating

**Issue**: Color picker changes but preview doesn't

**Solutions:**
1. Verify color is valid hex code
2. Check that state is updating (React DevTools)
3. Hard refresh the page

### Button Shape Not Changing

**Issue**: Button shape selection doesn't update preview

**Solutions:**
1. Verify button shape state is updating
2. Check that `getButtonClass()` function returns correct class
3. Inspect button element to see applied classes

## API Testing

### Test GET Endpoint

```bash
curl -X GET http://localhost:3000/api/business/onboarding/step-5-branding \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response:**
```json
{
  "branding": {
    "primaryColor": "#5B64FF",
    "secondaryColor": "#1a1a2e",
    "logoUrl": "https://...",
    "fontFamily": "Inter",
    "buttonShape": "rounded",
    "heroImageUrl": "https://...",
    "bookingPageDescription": "Your description here"
  }
}
```

### Test PUT Endpoint

```bash
curl -X PUT http://localhost:3000/api/business/onboarding/step-5-branding \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "primaryColor": "#FF0000",
    "secondaryColor": "#000000",
    "fontFamily": "Poppins",
    "buttonShape": "slightly-rounded",
    "bookingPageDescription": "Test description"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Branding information saved successfully"
}
```

## Checklist

- [ ] Primary color picker works and updates preview
- [ ] Secondary color picker works and updates preview
- [ ] Font family dropdown shows all 10 fonts
- [ ] Font changes are visible immediately in preview
- [ ] Button shape selection updates preview button
- [ ] Logo upload accepts square images
- [ ] Logo appears in top-right of preview
- [ ] Hero image upload works
- [ ] Hero image appears as background
- [ ] Description textarea works with character counter
- [ ] Description appears in preview
- [ ] All data persists when navigating away and back
- [ ] Public booking page shows all branding correctly
- [ ] Responsive design works on mobile/tablet/desktop
- [ ] Database stores all branding fields correctly

## Next Steps

After testing:
1. Verify all functionality works as expected
2. Test edge cases (very long descriptions, large images, etc.)
3. Test with different browsers (Chrome, Firefox, Safari)
4. Test on different devices (mobile, tablet, desktop)
5. Verify performance (font loading, image optimization)

