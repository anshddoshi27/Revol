/**
 * Onboarding Step 6 E2E Tests
 * 
 * End-to-end tests for the policies and confirmation message onboarding step.
 */

import { test, expect } from '@playwright/test';

test.describe('Onboarding Step 6: Policies & Confirmation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the policies step
    await page.goto('/onboarding/policies');
  });

  test('should display the policies step correctly', async ({ page }) => {
    // Check page title and progress
    await expect(page.locator('h1')).toContainText('Policies & Confirmation');
    await expect(page.locator('text=Step 6 of 8')).toBeVisible();
    
    // Check progress bar
    await expect(page.locator('.bg-blue-600')).toHaveCSS('width', '75%');
  });

  test('should navigate between sections', async ({ page }) => {
    // Check default section (policies)
    await expect(page.locator('text=Booking Policies')).toBeVisible();
    
    // Navigate to confirmation message section
    await page.click('text=Confirmation Message');
    await expect(page.locator('text=Confirmation Message')).toBeVisible();
    
    // Navigate to checkout warning section
    await page.click('text=Checkout Warning');
    await expect(page.locator('text=Checkout Warning')).toBeVisible();
  });

  test('should create booking policies', async ({ page }) => {
    // Click create policies button
    await page.click('text=Create Policies');
    
    // Fill in policy form
    await page.fill('input[name="cancellation_cutoff_hours"]', '24');
    await page.fill('input[name="no_show_fee_percent"]', '50');
    await page.fill('textarea[name="refund_policy"]', 'Refunds are available up to 24 hours before the appointment.');
    await page.fill('textarea[name="cash_logistics"]', 'Cash payments are accepted. Please bring exact change.');
    
    // Save policies
    await page.click('text=Save Policies');
    
    // Verify policies were saved
    await expect(page.locator('text=Current Policies')).toBeVisible();
    await expect(page.locator('text=24 hours notice required')).toBeVisible();
    await expect(page.locator('text=50%')).toBeVisible();
  });

  test('should use policy templates', async ({ page }) => {
    // Click create policies button
    await page.click('text=Create Policies');
    
    // Click templates button
    await page.click('text=Templates');
    
    // Select a template
    await page.click('text=24-Hour Cancellation');
    
    // Verify template was applied
    await expect(page.locator('input[name="cancellation_cutoff_hours"]')).toHaveValue('24');
  });

  test('should create confirmation message', async ({ page }) => {
    // Navigate to confirmation message section
    await page.click('text=Confirmation Message');
    
    // Click create message button
    await page.click('text=Create Message');
    
    // Fill in message content
    await page.fill('textarea[name="content"]', 'Thank you for booking with us! Your appointment is confirmed for {appointment_date} at {appointment_time}.');
    
    // Save message
    await page.click('text=Save Message');
    
    // Verify message was saved
    await expect(page.locator('text=Current Message')).toBeVisible();
    await expect(page.locator('text=Thank you for booking with us!')).toBeVisible();
  });

  test('should use confirmation message templates', async ({ page }) => {
    // Navigate to confirmation message section
    await page.click('text=Confirmation Message');
    
    // Click create message button
    await page.click('text=Create Message');
    
    // Click templates button
    await page.click('text=Templates');
    
    // Select a template
    await page.click('text=Standard Confirmation');
    
    // Verify template was applied
    await expect(page.locator('textarea[name="content"]')).toContainText('Thank you for booking with');
  });

  test('should use quick paste variables', async ({ page }) => {
    // Navigate to confirmation message section
    await page.click('text=Confirmation Message');
    
    // Click create message button
    await page.click('text=Create Message');
    
    // Click quick paste button
    await page.click('text=Quick Paste');
    
    // Verify quick paste options are shown
    await expect(page.locator('text=Quick Paste Variables')).toBeVisible();
    await expect(page.locator('text=Service Name')).toBeVisible();
    await expect(page.locator('text=Business Name')).toBeVisible();
    
    // Click on a quick paste option
    await page.click('text=Service Name');
    
    // Verify variable was inserted
    await expect(page.locator('textarea[name="content"]')).toContainText('{service_name}');
  });

  test('should preview confirmation message', async ({ page }) => {
    // Navigate to confirmation message section
    await page.click('text=Confirmation Message');
    
    // Click create message button
    await page.click('text=Create Message');
    
    // Fill in message content
    await page.fill('textarea[name="content"]', 'Thank you for booking with {business_name}!');
    
    // Click preview button
    await page.click('text=Preview');
    
    // Verify preview is shown
    await expect(page.locator('text=Preview')).toBeVisible();
  });

  test('should configure checkout warning', async ({ page }) => {
    // Navigate to checkout warning section
    await page.click('text=Checkout Warning');
    
    // Click configure warning button
    await page.click('text=Configure Warning');
    
    // Fill in warning form
    await page.fill('input[name="title"]', 'Payment Information');
    await page.fill('textarea[name="message"]', 'You will be charged after your appointment is completed.');
    await page.fill('input[name="acknowledgment_text"]', 'I understand the payment policy.');
    
    // Save warning
    await page.click('text=Save Warning');
    
    // Verify warning was saved (would need to implement the actual save functionality)
    await expect(page.locator('text=Payment Information')).toBeVisible();
  });

  test('should use checkout warning templates', async ({ page }) => {
    // Navigate to checkout warning section
    await page.click('text=Checkout Warning');
    
    // Click configure warning button
    await page.click('text=Configure Warning');
    
    // Click templates button
    await page.click('text=Templates');
    
    // Select a template
    await page.click('text=Attendance-Based Charging');
    
    // Verify template was applied
    await expect(page.locator('input[name="title"]')).toHaveValue('Payment Information');
  });

  test('should preview checkout warning', async ({ page }) => {
    // Navigate to checkout warning section
    await page.click('text=Checkout Warning');
    
    // Click configure warning button
    await page.click('text=Configure Warning');
    
    // Fill in warning form
    await page.fill('input[name="title"]', 'Payment Information');
    await page.fill('textarea[name="message"]', 'You will be charged after your appointment.');
    
    // Click preview button
    await page.click('text=Preview');
    
    // Verify preview is shown
    await expect(page.locator('text=Preview')).toBeVisible();
    await expect(page.locator('text=Payment Information')).toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    // Click create policies button
    await page.click('text=Create Policies');
    
    // Try to save without filling required fields
    await page.click('text=Save Policies');
    
    // Verify validation errors are shown
    await expect(page.locator('text=Cancellation cutoff is required')).toBeVisible();
    await expect(page.locator('text=Refund policy is required')).toBeVisible();
  });

  test('should show character count for text fields', async ({ page }) => {
    // Click create policies button
    await page.click('text=Create Policies');
    
    // Verify character counts are shown
    await expect(page.locator('text=/1000 characters/')).toBeVisible();
    await expect(page.locator('text=/500 characters/')).toBeVisible();
  });

  test('should navigate back to previous step', async ({ page }) => {
    // Click back button
    await page.click('text=Back');
    
    // Verify navigation to notifications step
    await expect(page).toHaveURL('/onboarding/notifications');
  });

  test('should continue to next step when policies and message are complete', async ({ page }) => {
    // Create policies first
    await page.click('text=Create Policies');
    await page.fill('input[name="cancellation_cutoff_hours"]', '24');
    await page.fill('input[name="no_show_fee_percent"]', '50');
    await page.fill('textarea[name="refund_policy"]', 'Test refund policy');
    await page.fill('textarea[name="cash_logistics"]', 'Test cash logistics');
    await page.click('text=Save Policies');
    
    // Create confirmation message
    await page.click('text=Confirmation Message');
    await page.click('text=Create Message');
    await page.fill('textarea[name="content"]', 'Test confirmation message');
    await page.click('text=Save Message');
    
    // Click continue button
    await page.click('text=Continue');
    
    // Verify navigation to next step
    await expect(page).toHaveURL('/onboarding/gift-cards');
  });

  test('should disable continue button when required data is missing', async ({ page }) => {
    // Verify continue button is disabled
    await expect(page.locator('text=Continue')).toBeDisabled();
  });

  test('should show loading states during save operations', async ({ page }) => {
    // Click create policies button
    await page.click('text=Create Policies');
    
    // Fill in form
    await page.fill('input[name="cancellation_cutoff_hours"]', '24');
    await page.fill('input[name="no_show_fee_percent"]', '50');
    await page.fill('textarea[name="refund_policy"]', 'Test refund policy');
    await page.fill('textarea[name="cash_logistics"]', 'Test cash logistics');
    
    // Click save and verify loading state
    await page.click('text=Save Policies');
    await expect(page.locator('text=Saving...')).toBeVisible();
  });
});


