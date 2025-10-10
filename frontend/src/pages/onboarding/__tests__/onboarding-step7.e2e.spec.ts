/**
 * Onboarding Step 7 E2E Tests
 * 
 * End-to-end tests for the gift card setup step.
 */

import { test, expect } from '@playwright/test';

test.describe('Onboarding Step 7 - Gift Cards', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the gift card setup step
    await page.goto('/onboarding/gift-cards');
  });

  test('should display gift card setup page', async ({ page }) => {
    await expect(page.getByText('Gift Cards')).toBeVisible();
    await expect(page.getByText('Step 7 of 8')).toBeVisible();
    await expect(page.getByText('Enable Gift Cards')).toBeVisible();
  });

  test('should allow skipping gift cards', async ({ page }) => {
    await page.getByText('Skip Gift Cards').click();
    
    // Should navigate to next step
    await expect(page).toHaveURL('/onboarding/payments');
  });

  test('should enable gift cards and show configuration options', async ({ page }) => {
    // Enable gift cards
    await page.getByRole('checkbox').check();
    
    // Should show configuration options
    await expect(page.getByText('Expiration Policy')).toBeVisible();
    await expect(page.getByText('Gift Card Amounts')).toBeVisible();
    await expect(page.getByText('Add New Amount')).toBeVisible();
  });

  test('should add common denomination amounts', async ({ page }) => {
    // Enable gift cards
    await page.getByRole('checkbox').check();
    
    // Add a common denomination
    await page.getByText('$25').click();
    
    // Should show the denomination in the list
    await expect(page.getByText('$25.00')).toBeVisible();
  });

  test('should add custom denomination amount', async ({ page }) => {
    // Enable gift cards
    await page.getByRole('checkbox').check();
    
    // Add custom amount
    await page.getByPlaceholder('0.00').fill('75.00');
    await page.getByText('Add Amount').click();
    
    // Should show the denomination in the list
    await expect(page.getByText('$75.00')).toBeVisible();
  });

  test('should validate denomination amounts', async ({ page }) => {
    // Enable gift cards
    await page.getByRole('checkbox').check();
    
    // Try to add invalid amount
    await page.getByPlaceholder('0.00').fill('2.00');
    await page.getByText('Add Amount').click();
    
    // Should show validation error
    await expect(page.getByText('Minimum amount is $5.00')).toBeVisible();
  });

  test('should prevent duplicate denominations', async ({ page }) => {
    // Enable gift cards
    await page.getByRole('checkbox').check();
    
    // Add first denomination
    await page.getByText('$25').click();
    
    // Try to add same denomination again
    await page.getByText('$25').click();
    
    // Should show duplicate error
    await expect(page.getByText('This amount already exists')).toBeVisible();
  });

  test('should edit existing denomination', async ({ page }) => {
    // Enable gift cards
    await page.getByRole('checkbox').check();
    
    // Add denomination
    await page.getByText('$25').click();
    
    // Edit the denomination
    await page.getByText('Edit').click();
    await page.getByDisplayValue('25.00').fill('30.00');
    await page.getByText('Save').click();
    
    // Should show updated amount
    await expect(page.getByText('$30.00')).toBeVisible();
  });

  test('should remove denomination with confirmation', async ({ page }) => {
    // Enable gift cards
    await page.getByRole('checkbox').check();
    
    // Add denomination
    await page.getByText('$25').click();
    
    // Remove the denomination
    await page.getByText('Remove').click();
    
    // Confirm removal
    page.on('dialog', dialog => dialog.accept());
    
    // Should remove the denomination
    await expect(page.getByText('$25.00')).not.toBeVisible();
  });

  test('should show preview modal', async ({ page }) => {
    // Enable gift cards
    await page.getByRole('checkbox').check();
    
    // Add denomination
    await page.getByText('$25').click();
    
    // Open preview
    await page.getByText('Preview').click();
    
    // Should show preview modal
    await expect(page.getByText('Gift Card Preview')).toBeVisible();
    await expect(page.getByText('Gift Cards Enabled')).toBeVisible();
    await expect(page.getByText('$25.00')).toBeVisible();
    
    // Close preview
    await page.getByText('Close Preview').click();
    await expect(page.getByText('Gift Card Preview')).not.toBeVisible();
  });

  test('should save gift card configuration and continue', async ({ page }) => {
    // Enable gift cards
    await page.getByRole('checkbox').check();
    
    // Add denomination
    await page.getByText('$25').click();
    
    // Save and continue
    await page.getByText('Save Gift Cards').click();
    
    // Should navigate to next step
    await expect(page).toHaveURL('/onboarding/payments');
  });

  test('should navigate back to previous step', async ({ page }) => {
    await page.getByText('Back').click();
    
    // Should navigate to previous step
    await expect(page).toHaveURL('/onboarding/policies');
  });

  test('should show loading state during save', async ({ page }) => {
    // Enable gift cards
    await page.getByRole('checkbox').check();
    
    // Add denomination
    await page.getByText('$25').click();
    
    // Start save process
    await page.getByText('Save Gift Cards').click();
    
    // Should show loading state
    await expect(page.getByText('Saving...')).toBeVisible();
  });

  test('should handle form validation errors', async ({ page }) => {
    // Enable gift cards but don't add any denominations
    await page.getByRole('checkbox').check();
    
    // Try to save without denominations
    await page.getByText('Save Gift Cards').click();
    
    // Should show validation error
    await expect(page.getByText('At least one denomination is required')).toBeVisible();
  });

  test('should be accessible with keyboard navigation', async ({ page }) => {
    // Tab through the form
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Should be able to toggle checkbox with space
    await page.keyboard.press(' ');
    
    // Should show configuration options
    await expect(page.getByText('Expiration Policy')).toBeVisible();
  });

  test('should be mobile responsive', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Should still show all elements
    await expect(page.getByText('Gift Cards')).toBeVisible();
    await expect(page.getByText('Enable Gift Cards')).toBeVisible();
    
    // Enable gift cards
    await page.getByRole('checkbox').check();
    
    // Should show configuration options
    await expect(page.getByText('Expiration Policy')).toBeVisible();
  });
});

