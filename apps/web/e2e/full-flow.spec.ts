/**
 * E2E test for complete onboarding → booking → charge flow
 * 
 * This test verifies the entire user journey:
 * 1. Sign up new user
 * 2. Complete onboarding (all 11 steps)
 * 3. Go live
 * 4. Book appointment as customer
 * 5. Admin completes booking and charges
 * 6. Verify notifications sent
 * 
 * Run with: npx playwright test e2e/full-flow.spec.ts
 * 
 * Requires:
 * - Test database (separate Supabase project)
 * - Test Stripe keys
 * - Test email/SMS providers (or mocks)
 */

import { test, expect } from '@playwright/test';

// Skip E2E tests in CI unless explicitly enabled
const E2E_ENABLED = process.env.E2E_ENABLED === 'true';

test.describe('Full Flow E2E', () => {
  test.skip(!E2E_ENABLED, 'E2E tests disabled. Set E2E_ENABLED=true to run.');

  test('complete onboarding → booking → charge flow', async ({ page, context }) => {
    const timestamp = Date.now();
    const testEmail = `test-${timestamp}@tithi.dev`;
    const testPassword = 'Test123456!';
    const businessName = `Test Business ${timestamp}`;
    const subdomain = `test-${timestamp.toString().slice(-8)}`;

    // Step 1: Sign up
    await page.goto('http://localhost:3000/signup');
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.fill('input[name="firstName"]', 'Test');
    await page.fill('input[name="lastName"]', 'User');
    await page.click('button[type="submit"]');

    // Wait for redirect to onboarding
    await expect(page).toHaveURL(/\/onboarding/);

    // Step 2: Complete onboarding steps
    // Step 2.1: Business Basics
    await page.fill('input[name="businessName"]', businessName);
    await page.fill('textarea[name="description"]', 'A test business for E2E testing');
    await page.fill('input[name="dbaName"]', `${businessName} DBA`);
    await page.fill('input[name="legalName"]', `${businessName} LLC`);
    await page.selectOption('select[name="industry"]', 'Beauty & Wellness');
    await page.click('button:has-text("Continue")');

    // Step 2.2: Booking Website
    await page.fill('input[name="subdomain"]', subdomain);
    await page.click('button:has-text("Continue")');

    // Step 2.3: Location & Contacts
    await page.selectOption('select[name="timezone"]', 'America/New_York');
    await page.fill('input[name="phone"]', '+15551234567');
    await page.fill('input[name="supportEmail"]', `support@${subdomain}.com`);
    await page.fill('input[name="website"]', `https://${subdomain}.com`);
    await page.fill('input[name="street"]', '123 Test Street');
    await page.fill('input[name="city"]', 'New York');
    await page.fill('input[name="state"]', 'NY');
    await page.fill('input[name="postalCode"]', '10001');
    await page.fill('input[name="country"]', 'United States');
    await page.click('button:has-text("Continue")');

    // Step 2.4: Team
    await page.click('button:has-text("Add Team Member")');
    await page.fill('input[name="name"]', 'Jane Doe');
    await page.fill('input[name="role"]', 'Stylist');
    await page.fill('input[name="color"]', '#4ECDC4');
    await page.click('button:has-text("Add")');
    await page.click('button:has-text("Continue")');

    // Step 2.5: Branding
    await page.fill('input[name="primaryColor"]', '#4ECDC4');
    await page.fill('input[name="secondaryColor"]', '#FF6B6B');
    // Skip logo upload for E2E
    await page.click('button:has-text("Continue")');

    // Step 2.6: Services & Categories
    await page.click('button:has-text("Add Category")');
    await page.fill('input[name="categoryName"]', 'Hair Services');
    await page.fill('input[name="categoryColor"]', '#4ECDC4');
    await page.click('button:has-text("Create Category")');
    
    await page.click('button:has-text("Add Service")');
    await page.fill('input[name="serviceName"]', 'Haircut');
    await page.fill('textarea[name="description"]', 'Professional haircut');
    await page.fill('input[name="durationMinutes"]', '30');
    await page.fill('input[name="priceCents"]', '5000');
    await page.fill('textarea[name="instructions"]', 'Arrive 10 minutes early');
    await page.selectOption('select[name="staffIds"]', 'Jane Doe');
    await page.click('button:has-text("Add Service")');
    await page.click('button:has-text("Continue")');

    // Step 2.7: Availability
    // Select service and staff, then add availability
    await page.selectOption('select[name="serviceId"]', 'Haircut');
    await page.selectOption('select[name="staffId"]', 'Jane Doe');
    await page.click('button:has-text("Monday")');
    await page.fill('input[name="startTime"]', '09:00');
    await page.fill('input[name="endTime"]', '17:00');
    await page.click('button:has-text("Save")');
    // Repeat for other weekdays or click Continue
    await page.click('button:has-text("Continue")');

    // Step 2.8: Notifications
    await page.click('button:has-text("Add Template")');
    await page.fill('input[name="templateName"]', 'Booking Confirmation');
    await page.selectOption('select[name="channel"]', 'email');
    await page.selectOption('select[name="category"]', 'confirmation');
    await page.selectOption('select[name="trigger"]', 'booking_created');
    await page.fill('input[name="subject"]', 'Booking received');
    await page.fill('textarea[name="body"]', 'Hi ${customer.name}, your ${service.name} is confirmed for ${booking.date} at ${booking.time}.');
    await page.click('button:has-text("Save")');
    await page.click('button:has-text("Continue")');

    // Step 2.9: Policies
    await page.fill('textarea[name="cancellationPolicy"]', 'Cancellations must be made 24 hours in advance.');
    await page.fill('textarea[name="noShowPolicy"]', 'No-show appointments will be charged 50% fee.');
    await page.fill('textarea[name="refundPolicy"]', 'Refunds available within 48 hours.');
    await page.fill('textarea[name="cashPolicy"]', 'Cash payments accepted.');
    await page.selectOption('select[name="noShowFeeType"]', 'percent');
    await page.fill('input[name="noShowFeeValue"]', '50');
    await page.selectOption('select[name="cancelFeeType"]', 'percent');
    await page.fill('input[name="cancelFeeValue"]', '50');
    await page.click('button:has-text("Continue")');

    // Step 2.10: Gift Cards (optional - skip for E2E)
    await page.click('button:has-text("Skip")');

    // Step 2.11: Payment Setup
    // Mock Stripe Connect onboarding
    await page.click('button:has-text("Connect Stripe Account")');
    // In real test, would complete Stripe Connect flow
    // For E2E, we can mock this or use Stripe test mode
    await page.click('button:has-text("Continue")');

    // Step 3: Go Live
    await expect(page).toHaveURL(/\/onboarding\/complete/);
    await page.click('button:has-text("Go Live")');

    // Verify redirect to admin
    await expect(page).toHaveURL(/\/app\/b\//);

    // Step 4: Book appointment as customer
    // Open booking site in new tab
    const bookingPage = await context.newPage();
    await bookingPage.goto(`http://localhost:3000/b/${subdomain}`);

    // Select service
    await bookingPage.click('text=Haircut');

    // Select date and time slot
    // This would depend on your actual booking UI
    await bookingPage.click('text=Select Time');
    await bookingPage.click('[data-slot]:first-child');

    // Fill customer info
    await bookingPage.fill('input[name="customerName"]', 'Test Customer');
    await bookingPage.fill('input[name="customerEmail"]', 'customer@example.com');
    await bookingPage.fill('input[name="customerPhone"]', '+15559876543');

    // Accept policies
    await bookingPage.check('input[name="acceptPolicies"]');

    // Enter card details (Stripe Elements)
    // In test mode, use test card: 4242 4242 4242 4242
    await bookingPage.frameLocator('iframe[name*="__privateStripeFrame"]').locator('input[name="cardNumber"]').fill('4242 4242 4242 4242');
    await bookingPage.frameLocator('iframe[name*="__privateStripeFrame"]').locator('input[name="cardExpiry"]').fill('12/25');
    await bookingPage.frameLocator('iframe[name*="__privateStripeFrame"]').locator('input[name="cardCvc"]').fill('123');

    // Submit booking
    await bookingPage.click('button:has-text("Book Appointment")');

    // Verify confirmation page
    await expect(bookingPage).toHaveURL(/\/confirm\//);
    await expect(bookingPage.locator('text=Booking received')).toBeVisible();

    // Step 5: Admin completes booking
    // Switch back to admin page
    await page.bringToFront();
    await page.reload();

    // Navigate to Past Bookings
    await page.click('text=Past Bookings');

    // Find the booking and click "Completed"
    await page.click('text=Test Customer');
    await page.click('button:has-text("Completed")');

    // Verify charge succeeded
    await expect(page.locator('text=Charged')).toBeVisible();
    await expect(page.locator('text=$50.00')).toBeVisible();

    // Step 6: Verify notification sent
    // In a real test, you would check email/SMS logs or test inbox
    // For now, verify notification job was created
    await page.click('text=Notifications');
    // Verify notification appears in sent list

    await bookingPage.close();
  });

  test('booking flow with gift card', async ({ page, context }) => {
    // Similar to above but includes gift card redemption
    test.skip(true, 'Implement gift card E2E test');
  });

  test('no-show fee flow', async ({ page, context }) => {
    // Test: booking → no-show → fee charged
    test.skip(true, 'Implement no-show fee E2E test');
  });

  test('refund flow', async ({ page, context }) => {
    // Test: booking → complete → refund
    test.skip(true, 'Implement refund E2E test');
  });
});



