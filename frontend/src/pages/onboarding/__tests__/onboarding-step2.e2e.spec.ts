/**
 * Onboarding Step 2 E2E Tests
 * 
 * End-to-end tests for the logo and brand colors onboarding step.
 * Tests the complete user journey from file upload to color selection.
 */

import { test, expect } from '@playwright/test';

// ===== TEST DATA =====

const mockBusinessData = {
  name: 'Test Salon',
  description: 'A test salon for automated testing',
  timezone: 'America/New_York',
  slug: 'test-salon',
  dba: 'Test Salon LLC',
  industry: 'Beauty & Wellness',
  address: {
    street: '123 Test St',
    city: 'Test City',
    state_province: 'NY',
    postal_code: '10001',
    country: 'US',
  },
  website: 'https://testsalon.com',
  phone: '+1-555-0123',
  support_email: 'support@testsalon.com',
  staff: [
    {
      role: 'Stylist',
      name: 'Jane Doe',
      color: '#3B82F6',
    },
  ],
  social_links: {
    instagram: '@testsalon',
    website: 'https://testsalon.com',
  },
};

// ===== TEST SUITE =====

test.describe('Onboarding Step 2: Logo & Brand Colors', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to step 2 with mock data from step 1
    await page.goto('/onboarding/logo-colors', {
      state: { step1Data: mockBusinessData },
    });
  });

  test('should display step 2 page correctly', async ({ page }) => {
    // Check page title and description
    await expect(page.getByRole('heading', { name: 'Logo & Brand Colors' })).toBeVisible();
    await expect(page.getByText('Let\'s create your visual identity')).toBeVisible();
    
    // Check step indicator
    await expect(page.getByText('Step 2 of 4')).toBeVisible();
    
    // Check navigation buttons
    await expect(page.getByRole('button', { name: 'Back' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save & Continue' })).toBeVisible();
  });

  test('should display logo upload section', async ({ page }) => {
    // Check logo upload section
    await expect(page.getByRole('heading', { name: 'Upload Your Logo' })).toBeVisible();
    await expect(page.getByText('Drag & drop your logo here, or click to browse')).toBeVisible();
    
    // Check file requirements
    await expect(page.getByText('Supported formats: PNG, JPG, SVG')).toBeVisible();
    await expect(page.getByText('Maximum file size: 2MB')).toBeVisible();
    await expect(page.getByText('Recommended size: 640×560px or larger')).toBeVisible();
  });

  test('should display color picker section', async ({ page }) => {
    // Check color picker section
    await expect(page.getByRole('heading', { name: 'Choose your brand color' })).toBeVisible();
    await expect(page.getByText('Select a primary color that represents your brand')).toBeVisible();
    
    // Check preset colors
    await expect(page.getByText('Popular colors')).toBeVisible();
    await expect(page.getByLabelText('Select Blue color')).toBeVisible();
    await expect(page.getByLabelText('Select Green color')).toBeVisible();
    
    // Check custom color option
    await expect(page.getByText('Custom color')).toBeVisible();
    await expect(page.getByText('Choose custom color')).toBeVisible();
  });

  test('should display logo preview section', async ({ page }) => {
    // Check preview section
    await expect(page.getByRole('heading', { name: 'Logo Preview' })).toBeVisible();
    await expect(page.getByText('Upload a logo to see how it will appear on your booking pages')).toBeVisible();
  });

  test('should handle logo upload with valid file', async ({ page }) => {
    // Create a mock image file
    const fileBuffer = Buffer.from('fake-image-data');
    
    // Set up file chooser
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Choose File' }).click();
    const fileChooser = await fileChooserPromise;
    
    // Upload the file
    await fileChooser.setFiles({
      name: 'test-logo.png',
      mimeType: 'image/png',
      buffer: fileBuffer,
    });

    // Wait for processing to complete
    await page.waitForSelector('text=Logo uploaded successfully!', { timeout: 5000 });
    
    // Check that preview is shown
    await expect(page.getByAltText('Logo preview')).toBeVisible();
  });

  test('should handle logo upload with invalid file type', async ({ page }) => {
    // Create a mock text file
    const fileBuffer = Buffer.from('fake-text-data');
    
    // Set up file chooser
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Choose File' }).click();
    const fileChooser = await fileChooserPromise;
    
    // Upload the invalid file
    await fileChooser.setFiles({
      name: 'test-file.txt',
      mimeType: 'text/plain',
      buffer: fileBuffer,
    });

    // Check for error message
    await expect(page.getByText('Invalid file type')).toBeVisible();
  });

  test('should handle logo upload with oversized file', async ({ page }) => {
    // Create a mock oversized file (3MB)
    const fileBuffer = Buffer.alloc(3 * 1024 * 1024);
    
    // Set up file chooser
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Choose File' }).click();
    const fileChooser = await fileChooserPromise;
    
    // Upload the oversized file
    await fileChooser.setFiles({
      name: 'large-logo.png',
      mimeType: 'image/png',
      buffer: fileBuffer,
    });

    // Check for error message
    await expect(page.getByText('File size too large')).toBeVisible();
  });

  test('should handle color selection', async ({ page }) => {
    // Select a preset color
    await page.getByLabelText('Select Green color').click();
    
    // Check that contrast validation is shown
    await expect(page.getByText('Contrast Ratio:')).toBeVisible();
    await expect(page.getByText('WCAG AA')).toBeVisible();
  });

  test('should handle custom color selection', async ({ page }) => {
    // Open custom color picker
    await page.getByText('Choose custom color').click();
    
    // Check that custom picker is shown
    await expect(page.getByLabelText('Custom color picker')).toBeVisible();
    await expect(page.getByDisplayValue('#3B82F6')).toBeVisible();
    
    // Change color
    await page.getByDisplayValue('#3B82F6').fill('#FF0000');
    
    // Apply the color
    await page.getByRole('button', { name: 'Apply' }).click();
    
    // Check that custom picker is closed
    await expect(page.getByText('Choose custom color')).toBeVisible();
  });

  test('should show contrast validation for different colors', async ({ page }) => {
    // Test with high contrast color (black)
    await page.getByText('Choose custom color').click();
    await page.getByDisplayValue('#3B82F6').fill('#000000');
    await page.getByRole('button', { name: 'Apply' }).click();
    
    // Should show good contrast
    await expect(page.getByText('WCAG AAA')).toBeVisible();
    
    // Test with low contrast color (light gray)
    await page.getByText('Choose custom color').click();
    await page.getByDisplayValue('#000000').fill('#F0F0F0');
    await page.getByRole('button', { name: 'Apply' }).click();
    
    // Should show poor contrast
    await expect(page.getByText('WCAG FAIL')).toBeVisible();
  });

  test('should show logo preview when logo is uploaded', async ({ page }) => {
    // Upload a logo first
    const fileBuffer = Buffer.from('fake-image-data');
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Choose File' }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'test-logo.png',
      mimeType: 'image/png',
      buffer: fileBuffer,
    });
    
    await page.waitForSelector('text=Logo uploaded successfully!', { timeout: 5000 });
    
    // Check that preview sections are shown
    await expect(page.getByText('Welcome Page')).toBeVisible();
    await expect(page.getByText('Navigation')).toBeVisible();
    await expect(page.getByText('Mobile')).toBeVisible();
  });

  test('should allow logo removal', async ({ page }) => {
    // Upload a logo first
    const fileBuffer = Buffer.from('fake-image-data');
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Choose File' }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'test-logo.png',
      mimeType: 'image/png',
      buffer: fileBuffer,
    });
    
    await page.waitForSelector('text=Logo uploaded successfully!', { timeout: 5000 });
    
    // Remove the logo
    await page.getByLabelText('Remove logo').click();
    
    // Check that upload area is shown again
    await expect(page.getByText('Upload your logo')).toBeVisible();
  });

  test('should validate form before submission', async ({ page }) => {
    // Try to submit without selecting a color (should fail validation)
    await page.getByRole('button', { name: 'Save & Continue' }).click();
    
    // Should show validation error
    await expect(page.getByText('Please select a primary color')).toBeVisible();
  });

  test('should submit form with valid data', async ({ page }) => {
    // Select a color
    await page.getByLabelText('Select Blue color').click();
    
    // Submit the form
    await page.getByRole('button', { name: 'Save & Continue' }).click();
    
    // Should navigate to next step
    await expect(page).toHaveURL('/onboarding/services');
  });

  test('should handle back navigation', async ({ page }) => {
    // Click back button
    await page.getByRole('button', { name: 'Back' }).click();
    
    // Should navigate to previous step
    await expect(page).toHaveURL('/onboarding/step-1');
  });

  test('should show help section', async ({ page }) => {
    // Scroll to help section
    await page.getByRole('heading', { name: 'Need Help?' }).scrollIntoViewIfNeeded();
    
    // Check help content
    await expect(page.getByText('Logo Guidelines')).toBeVisible();
    await expect(page.getByText('Color Guidelines')).toBeVisible();
    await expect(page.getByText('Use PNG, JPG, or SVG format')).toBeVisible();
    await expect(page.getByText('Must meet WCAG AA accessibility standards')).toBeVisible();
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Check that content is still accessible
    await expect(page.getByRole('heading', { name: 'Logo & Brand Colors' })).toBeVisible();
    await expect(page.getByText('Upload your logo')).toBeVisible();
    await expect(page.getByText('Choose your brand color')).toBeVisible();
    
    // Check that buttons are still clickable
    await expect(page.getByRole('button', { name: 'Choose File' })).toBeVisible();
    await expect(page.getByLabelText('Select Blue color')).toBeVisible();
  });

  test('should handle drag and drop for logo upload', async ({ page }) => {
    // Create a mock image file
    const fileBuffer = Buffer.from('fake-image-data');
    
    // Simulate drag and drop
    const dropZone = page.locator('[data-testid="dropzone"]').first();
    await dropZone.dispatchEvent('dragover');
    await dropZone.dispatchEvent('drop', {
      dataTransfer: {
        files: [{
          name: 'test-logo.png',
          type: 'image/png',
          buffer: fileBuffer,
        }],
      },
    });

    // Wait for processing to complete
    await page.waitForSelector('text=Logo uploaded successfully!', { timeout: 5000 });
    
    // Check that preview is shown
    await expect(page.getByAltText('Logo preview')).toBeVisible();
  });
});
