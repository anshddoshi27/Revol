/**
 * Onboarding Step 1 E2E Tests
 * 
 * End-to-end tests for the business details onboarding step.
 */

import { test, expect } from '@playwright/test';

test.describe('Onboarding Step 1 - Business Details', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the onboarding step 1 page
    await page.goto('/onboarding/details');
  });

  test('displays the business details form', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /business details/i })).toBeVisible();
    await expect(page.getByLabelText(/business name/i)).toBeVisible();
    await expect(page.getByLabelText(/subdomain/i)).toBeVisible();
    await expect(page.getByLabelText(/timezone/i)).toBeVisible();
  });

  test('shows progress indicator', async ({ page }) => {
    await expect(page.getByText('Step 1 of 8')).toBeVisible();
    await expect(page.locator('[role="progressbar"]')).toBeVisible();
  });

  test('validates required fields', async ({ page }) => {
    // Try to submit without filling required fields
    await page.getByRole('button', { name: /save & continue/i }).click();

    // Should show validation errors
    await expect(page.getByText(/business name is required/i)).toBeVisible();
    await expect(page.getByText(/subdomain is required/i)).toBeVisible();
    await expect(page.getByText(/timezone is required/i)).toBeVisible();
  });

  test('auto-generates subdomain from business name', async ({ page }) => {
    const businessNameInput = page.getByLabelText(/business name/i);
    const subdomainInput = page.getByLabelText(/subdomain/i);

    await businessNameInput.fill('My Amazing Salon');
    
    // Wait for auto-generation
    await page.waitForTimeout(100);
    
    await expect(subdomainInput).toHaveValue('my-amazing-salon');
  });

  test('validates subdomain availability', async ({ page }) => {
    const subdomainInput = page.getByLabelText(/subdomain/i);
    
    await subdomainInput.fill('test-subdomain');
    
    // Wait for validation
    await page.waitForTimeout(600);
    
    // Should show availability status
    await expect(page.getByText(/checking availability/i)).toBeVisible();
  });

  test('allows adding team members', async ({ page }) => {
    // Fill required fields first
    await page.getByLabelText(/business name/i).fill('Test Business');
    await page.getByLabelText(/subdomain/i).fill('test-business');
    
    // Add a team member
    await page.getByLabelText('Role').selectOption('Stylist');
    await page.getByLabelText('Name').fill('John Doe');
    await page.getByRole('button', { name: /add team member/i }).click();
    
    // Should show the team member
    await expect(page.getByDisplayValue('John Doe')).toBeVisible();
    await expect(page.getByDisplayValue('Stylist')).toBeVisible();
  });

  test('allows removing team members', async ({ page }) => {
    // Fill required fields first
    await page.getByLabelText(/business name/i).fill('Test Business');
    await page.getByLabelText(/subdomain/i).fill('test-business');
    
    // Add a team member
    await page.getByLabelText('Role').selectOption('Stylist');
    await page.getByLabelText('Name').fill('John Doe');
    await page.getByRole('button', { name: /add team member/i }).click();
    
    // Remove the team member
    await page.getByLabelText(/remove john doe/i).click();
    
    // Should no longer show the team member
    await expect(page.getByDisplayValue('John Doe')).not.toBeVisible();
  });

  test('validates email format', async ({ page }) => {
    const emailInput = page.getByLabelText(/support email/i);
    
    await emailInput.fill('invalid-email');
    
    // Try to submit
    await page.getByRole('button', { name: /save & continue/i }).click();
    
    // Should show email validation error
    await expect(page.getByText(/please enter a valid email address/i)).toBeVisible();
  });

  test('validates website URL format', async ({ page }) => {
    const websiteInput = page.getByLabelText(/website/i);
    
    await websiteInput.fill('invalid-url');
    
    // Try to submit
    await page.getByRole('button', { name: /save & continue/i }).click();
    
    // Should show URL validation error
    await expect(page.getByText(/please enter a valid website url/i)).toBeVisible();
  });

  test('allows filling optional fields', async ({ page }) => {
    // Fill required fields
    await page.getByLabelText(/business name/i).fill('Test Business');
    await page.getByLabelText(/subdomain/i).fill('test-business');
    
    // Fill optional fields
    await page.getByLabelText(/business description/i).fill('A great business');
    await page.getByLabelText(/dba/i).fill('Test Business LLC');
    await page.getByLabelText(/industry/i).selectOption('Beauty & Wellness');
    await page.getByLabelText(/phone/i).fill('+1 (555) 123-4567');
    await page.getByLabelText(/support email/i).fill('support@testbusiness.com');
    await page.getByLabelText(/website/i).fill('https://testbusiness.com');
    
    // Fill address
    await page.getByLabelText(/street address/i).fill('123 Main St');
    await page.getByLabelText(/city/i).fill('New York');
    await page.getByLabelText(/state\/province/i).fill('NY');
    await page.getByLabelText(/postal code/i).fill('10001');
    
    // Fill social links
    await page.getByLabelText(/instagram/i).fill('@testbusiness');
    await page.getByLabelText(/facebook/i).fill('https://facebook.com/testbusiness');
    
    // All fields should be filled
    await expect(page.getByDisplayValue('Test Business')).toBeVisible();
    await expect(page.getByDisplayValue('A great business')).toBeVisible();
    await expect(page.getByDisplayValue('Test Business LLC')).toBeVisible();
    await expect(page.getByDisplayValue('+1 (555) 123-4567')).toBeVisible();
    await expect(page.getByDisplayValue('support@testbusiness.com')).toBeVisible();
    await expect(page.getByDisplayValue('https://testbusiness.com')).toBeVisible();
    await expect(page.getByDisplayValue('123 Main St')).toBeVisible();
    await expect(page.getByDisplayValue('New York')).toBeVisible();
    await expect(page.getByDisplayValue('NY')).toBeVisible();
    await expect(page.getByDisplayValue('10001')).toBeVisible();
    await expect(page.getByDisplayValue('@testbusiness')).toBeVisible();
    await expect(page.getByDisplayValue('https://facebook.com/testbusiness')).toBeVisible();
  });

  test('navigates to next step on successful submission', async ({ page }) => {
    // Mock successful API response
    await page.route('**/onboarding/register', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-tenant-id',
          business_name: 'Test Business',
          slug: 'test-business',
          subdomain: 'test-business.tithi.com',
          status: 'active',
        }),
      });
    });

    await page.route('**/onboarding/check-subdomain/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          subdomain: 'test-business',
          available: true,
          suggested_url: 'test-business.tithi.com',
        }),
      });
    });

    // Fill required fields
    await page.getByLabelText(/business name/i).fill('Test Business');
    await page.getByLabelText(/subdomain/i).fill('test-business');
    
    // Wait for subdomain validation
    await page.waitForTimeout(600);
    
    // Submit form
    await page.getByRole('button', { name: /save & continue/i }).click();
    
    // Should navigate to next step
    await expect(page).toHaveURL('/onboarding/logo-colors');
  });

  test('shows back button and navigates back', async ({ page }) => {
    const backButton = page.getByRole('button', { name: /back/i });
    await expect(backButton).toBeVisible();
    
    await backButton.click();
    
    // Should navigate back to signup
    await expect(page).toHaveURL('/signup');
  });

  test('displays help section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /need help/i })).toBeVisible();
    await expect(page.getByText(/business name:/i)).toBeVisible();
    await expect(page.getByText(/subdomain:/i)).toBeVisible();
    await expect(page.getByText(/team members:/i)).toBeVisible();
    await expect(page.getByText(/social media:/i)).toBeVisible();
  });

  test('is accessible with keyboard navigation', async ({ page }) => {
    // Tab through form elements
    await page.keyboard.press('Tab');
    await expect(page.getByLabelText(/business name/i)).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(page.getByLabelText(/business description/i)).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(page.getByLabelText(/dba/i)).toBeFocused();
    
    // Continue tabbing through other fields
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Should reach the submit button
    await expect(page.getByRole('button', { name: /save & continue/i })).toBeFocused();
  });

  test('shows loading state during submission', async ({ page }) => {
    // Mock slow API response
    await page.route('**/onboarding/register', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-tenant-id',
          business_name: 'Test Business',
          slug: 'test-business',
          subdomain: 'test-business.tithi.com',
          status: 'active',
        }),
      });
    });

    await page.route('**/onboarding/check-subdomain/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          subdomain: 'test-business',
          available: true,
          suggested_url: 'test-business.tithi.com',
        }),
      });
    });

    // Fill required fields
    await page.getByLabelText(/business name/i).fill('Test Business');
    await page.getByLabelText(/subdomain/i).fill('test-business');
    
    // Wait for subdomain validation
    await page.waitForTimeout(600);
    
    // Submit form
    await page.getByRole('button', { name: /save & continue/i }).click();
    
    // Should show loading state
    await expect(page.getByText('Saving...')).toBeVisible();
    
    // Button should be disabled
    await expect(page.getByRole('button', { name: /saving/i })).toBeDisabled();
  });
});
