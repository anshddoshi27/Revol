/**
 * Onboarding Step 3 E2E Tests
 * 
 * End-to-end tests for the onboarding step 3 (Services, Categories & Defaults).
 */

import { test, expect } from '@playwright/test';

test.describe('Onboarding Step 3: Services & Categories', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to step 3 with mock data from previous steps
    await page.goto('/onboarding/services', {
      state: {
        step1Data: {
          name: 'Test Business',
          slug: 'test-business',
          timezone: 'America/New_York',
        },
        step2Data: {
          logo_url: 'https://example.com/logo.png',
          primary_color: '#3B82F6',
        },
      },
    });
  });

  test('displays step 3 page correctly', async ({ page }) => {
    await expect(page.getByText('Step 3: Services & Categories')).toBeVisible();
    await expect(page.getByText('Service Catalog Setup')).toBeVisible();
    await expect(page.getByText('Create categories and services that customers can book')).toBeVisible();
  });

  test('shows progress indicator', async ({ page }) => {
    await expect(page.getByText('3 of 4')).toBeVisible();
    await expect(page.locator('.bg-blue-600')).toHaveCSS('width', '75%');
  });

  test('displays categories tab by default', async ({ page }) => {
    await expect(page.getByText('Categories')).toBeVisible();
    await expect(page.getByText('Service Categories')).toBeVisible();
    await expect(page.getByText('Organize your services into categories')).toBeVisible();
  });

  test('can switch to services tab', async ({ page }) => {
    await page.getByText('Services (0)').click();
    
    await expect(page.getByText('Services')).toBeVisible();
    await expect(page.getByText('Create services that customers can book')).toBeVisible();
  });

  test('shows empty state for categories', async ({ page }) => {
    await expect(page.getByText('No categories yet')).toBeVisible();
    await expect(page.getByText('Get started by creating your first service category')).toBeVisible();
  });

  test('can create a new category', async ({ page }) => {
    // Click add category button
    await page.getByText('Add Category').click();
    
    // Fill category form
    await page.getByLabel('Category Name *').fill('Hair Services');
    await page.getByLabel('Description').fill('All hair-related services');
    
    // Select a color (first available color)
    await page.locator('[style*="background-color: #3B82F6"]').click();
    
    // Submit form
    await page.getByText('Add Category').click();
    
    // Verify category was created
    await expect(page.getByText('Hair Services')).toBeVisible();
    await expect(page.getByText('All hair-related services')).toBeVisible();
  });

  test('validates category form', async ({ page }) => {
    // Click add category button
    await page.getByText('Add Category').click();
    
    // Try to submit without filling required fields
    await page.getByText('Add Category').click();
    
    // Should show validation error
    await expect(page.getByText('Category name is required')).toBeVisible();
  });

  test('can edit a category', async ({ page }) => {
    // First create a category
    await page.getByText('Add Category').click();
    await page.getByLabel('Category Name *').fill('Test Category');
    await page.getByText('Add Category').click();
    
    // Edit the category
    await page.getByLabel('Edit category Test Category').click();
    
    // Update the name
    await page.getByLabel('Category Name *').fill('Updated Category');
    await page.getByText('Update Category').click();
    
    // Verify update
    await expect(page.getByText('Updated Category')).toBeVisible();
  });

  test('can delete a category', async ({ page }) => {
    // First create a category
    await page.getByText('Add Category').click();
    await page.getByLabel('Category Name *').fill('Test Category');
    await page.getByText('Add Category').click();
    
    // Delete the category
    await page.getByLabel('Delete category Test Category').click();
    await page.getByText('Confirm').click();
    
    // Verify deletion
    await expect(page.getByText('Test Category')).not.toBeVisible();
    await expect(page.getByText('No categories yet')).toBeVisible();
  });

  test('shows empty state for services', async ({ page }) => {
    await page.getByText('Services (0)').click();
    
    await expect(page.getByText('No services yet')).toBeVisible();
    await expect(page.getByText('Get started by creating your first service')).toBeVisible();
  });

  test('can create a new service', async ({ page }) => {
    // Switch to services tab
    await page.getByText('Services (0)').click();
    
    // Click add service button
    await page.getByText('Add Service').click();
    
    // Fill service form
    await page.getByLabel('Service Name *').fill('Haircut & Style');
    await page.getByLabel('Description *').fill('Professional haircut and styling service');
    await page.getByLabel('Duration (minutes) *').fill('60');
    await page.getByLabel('Price (cents) *').fill('5000');
    
    // Submit form
    await page.getByText('Create Service').click();
    
    // Should return to services list
    await expect(page.getByText('Services (1)')).toBeVisible();
    await expect(page.getByText('Haircut & Style')).toBeVisible();
    await expect(page.getByText('Professional haircut and styling service')).toBeVisible();
  });

  test('validates service form', async ({ page }) => {
    // Switch to services tab
    await page.getByText('Services (0)').click();
    
    // Click add service button
    await page.getByText('Add Service').click();
    
    // Try to submit without filling required fields
    await page.getByText('Create Service').click();
    
    // Should show validation errors
    await expect(page.getByText('Service name is required')).toBeVisible();
    await expect(page.getByText('Service description is required')).toBeVisible();
  });

  test('can edit a service', async ({ page }) => {
    // First create a service
    await page.getByText('Services (0)').click();
    await page.getByText('Add Service').click();
    await page.getByLabel('Service Name *').fill('Test Service');
    await page.getByLabel('Description *').fill('Test description');
    await page.getByLabel('Duration (minutes) *').fill('60');
    await page.getByLabel('Price (cents) *').fill('5000');
    await page.getByText('Create Service').click();
    
    // Edit the service
    await page.getByLabel('Edit Test Service').click();
    
    // Update the name
    await page.getByLabel('Service Name *').fill('Updated Service');
    await page.getByText('Update Service').click();
    
    // Should return to services list
    await expect(page.getByText('Updated Service')).toBeVisible();
  });

  test('can delete a service', async ({ page }) => {
    // First create a service
    await page.getByText('Services (0)').click();
    await page.getByText('Add Service').click();
    await page.getByLabel('Service Name *').fill('Test Service');
    await page.getByLabel('Description *').fill('Test description');
    await page.getByLabel('Duration (minutes) *').fill('60');
    await page.getByLabel('Price (cents) *').fill('5000');
    await page.getByText('Create Service').click();
    
    // Delete the service
    await page.getByLabel('Delete Test Service').click();
    
    // Confirm deletion in dialog
    await page.getByText('Are you sure you want to delete this service?').click();
    await page.getByText('OK').click();
    
    // Verify deletion
    await expect(page.getByText('Test Service')).not.toBeVisible();
    await expect(page.getByText('No services yet')).toBeVisible();
  });

  test('can configure special requests for service', async ({ page }) => {
    // Switch to services tab and create a service
    await page.getByText('Services (0)').click();
    await page.getByText('Add Service').click();
    await page.getByLabel('Service Name *').fill('Test Service');
    await page.getByLabel('Description *').fill('Test description');
    await page.getByLabel('Duration (minutes) *').fill('60');
    await page.getByLabel('Price (cents) *').fill('5000');
    
    // Enable special requests
    await page.getByText('Enable Special Requests').click();
    
    // Configure quick chips
    await page.getByText('Hair wash included').click();
    await page.getByText('Blow dry included').click();
    
    // Add custom option
    await page.getByPlaceholder('Enter custom option...').fill('Deep conditioning');
    await page.getByText('Add').click();
    
    // Submit form
    await page.getByText('Create Service').click();
    
    // Verify service was created with special requests
    await expect(page.getByText('Test Service')).toBeVisible();
  });

  test('can upload service image', async ({ page }) => {
    // Switch to services tab and create a service
    await page.getByText('Services (0)').click();
    await page.getByText('Add Service').click();
    await page.getByLabel('Service Name *').fill('Test Service');
    await page.getByLabel('Description *').fill('Test description');
    await page.getByLabel('Duration (minutes) *').fill('60');
    await page.getByLabel('Price (cents) *').fill('5000');
    
    // Upload image (mock file)
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-image.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-image-data'),
    });
    
    // Submit form
    await page.getByText('Create Service').click();
    
    // Verify service was created
    await expect(page.getByText('Test Service')).toBeVisible();
  });

  test('prevents proceeding without services', async ({ page }) => {
    // Try to continue without creating any services
    await page.getByText('Continue to Availability').click();
    
    // Should show error
    await expect(page.getByText('Please create at least one service before continuing')).toBeVisible();
  });

  test('can proceed to next step with services', async ({ page }) => {
    // Create a service
    await page.getByText('Services (0)').click();
    await page.getByText('Add Service').click();
    await page.getByLabel('Service Name *').fill('Test Service');
    await page.getByLabel('Description *').fill('Test description');
    await page.getByLabel('Duration (minutes) *').fill('60');
    await page.getByLabel('Price (cents) *').fill('5000');
    await page.getByText('Create Service').click();
    
    // Continue to next step
    await page.getByText('Continue to Availability').click();
    
    // Should navigate to availability step
    await expect(page).toHaveURL('/onboarding/availability');
  });

  test('can go back to previous step', async ({ page }) => {
    await page.getByText('Back').click();
    
    // Should navigate back to logo-colors step
    await expect(page).toHaveURL('/onboarding/logo-colors');
  });

  test('shows progress indicators correctly', async ({ page }) => {
    // Initially should show 0 categories and 0 services
    await expect(page.getByText('0 Categories')).toBeVisible();
    await expect(page.getByText('0 Services')).toBeVisible();
    
    // Create a category
    await page.getByText('Add Category').click();
    await page.getByLabel('Category Name *').fill('Test Category');
    await page.getByText('Add Category').click();
    
    // Should show 1 category
    await expect(page.getByText('1 Categories')).toBeVisible();
    
    // Create a service
    await page.getByText('Services (0)').click();
    await page.getByText('Add Service').click();
    await page.getByLabel('Service Name *').fill('Test Service');
    await page.getByLabel('Description *').fill('Test description');
    await page.getByLabel('Duration (minutes) *').fill('60');
    await page.getByLabel('Price (cents) *').fill('5000');
    await page.getByText('Create Service').click();
    
    // Should show 1 service
    await expect(page.getByText('Services (1)')).toBeVisible();
  });
});
