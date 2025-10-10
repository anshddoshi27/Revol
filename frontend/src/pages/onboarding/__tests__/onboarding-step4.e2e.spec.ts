/**
 * Onboarding Step 4 E2E Tests
 * 
 * End-to-end tests for the availability setup step of the onboarding process.
 */

import { test, expect } from '@playwright/test';

test.describe('Onboarding Step 4: Availability Setup', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to step 4 with mock data
    await page.goto('/onboarding/availability', {
      state: {
        step1Data: {
          name: 'Test Salon',
          slug: 'test-salon',
          timezone: 'America/New_York',
          staff: [
            {
              id: 'staff-1',
              name: 'John Doe',
              role: 'Stylist',
              color: '#3B82F6',
            },
            {
              id: 'staff-2',
              name: 'Jane Smith',
              role: 'Manager',
              color: '#10B981',
            },
          ],
        },
        step2Data: {
          logo: 'test-logo.png',
          primary_color: '#3B82F6',
        },
        step3Data: {
          services: [
            {
              id: 'service-1',
              name: 'Haircut',
              duration_minutes: 60,
              price_cents: 5000,
            },
          ],
        },
      },
    });
  });

  test('should display the availability calendar page', async ({ page }) => {
    await expect(page.getByText('Set Up Availability')).toBeVisible();
    await expect(page.getByText('Step 4 of 8')).toBeVisible();
    await expect(page.getByText('Availability Calendar')).toBeVisible();
  });

  test('should show staff members in the calendar', async ({ page }) => {
    await expect(page.getByText('John Doe')).toBeVisible();
    await expect(page.getByText('Stylist')).toBeVisible();
    await expect(page.getByText('Jane Smith')).toBeVisible();
    await expect(page.getByText('Manager')).toBeVisible();
  });

  test('should display day headers', async ({ page }) => {
    await expect(page.getByText('Staff')).toBeVisible();
    await expect(page.getByText('Sun')).toBeVisible();
    await expect(page.getByText('Mon')).toBeVisible();
    await expect(page.getByText('Tue')).toBeVisible();
    await expect(page.getByText('Wed')).toBeVisible();
    await expect(page.getByText('Thu')).toBeVisible();
    await expect(page.getByText('Fri')).toBeVisible();
    await expect(page.getByText('Sat')).toBeVisible();
  });

  test('should show progress summary cards', async ({ page }) => {
    await expect(page.getByText('2')).toBeVisible(); // Staff count
    await expect(page.getByText('Staff Members')).toBeVisible();
    await expect(page.getByText('With Availability')).toBeVisible();
    await expect(page.getByText('Total Hours/Week')).toBeVisible();
  });

  test('should open time block editor when add button is clicked', async ({ page }) => {
    // Click the first "Add" button
    const addButtons = page.getByText('Add');
    await addButtons.first().click();

    // Should open the time block editor modal
    await expect(page.getByText('Add Time Block')).toBeVisible();
    await expect(page.getByText('Staff Member')).toBeVisible();
    await expect(page.getByText('Day of Week')).toBeVisible();
    await expect(page.getByText('Start Time')).toBeVisible();
    await expect(page.getByText('End Time')).toBeVisible();
  });

  test('should create a time block successfully', async ({ page }) => {
    // Click the first "Add" button
    const addButtons = page.getByText('Add');
    await addButtons.first().click();

    // Fill out the form
    await page.selectOption('select[id="staff_id"]', 'staff-1');
    await page.selectOption('select[id="day_of_week"]', '1'); // Monday
    await page.selectOption('select[id="start_time"]', '09:00');
    await page.selectOption('select[id="end_time"]', '17:00');

    // Submit the form
    await page.click('button[type="submit"]');

    // Should close the modal and show the time block
    await expect(page.getByText('Add Time Block')).not.toBeVisible();
    await expect(page.getByText('9:00 AM - 5:00 PM')).toBeVisible();
  });

  test('should show validation errors for invalid time blocks', async ({ page }) => {
    // Click the first "Add" button
    const addButtons = page.getByText('Add');
    await addButtons.first().click();

    // Try to submit without selecting staff
    await page.click('button[type="submit"]');

    // Should show validation error
    await expect(page.getByText('Staff member is required')).toBeVisible();
  });

  test('should open recurring pattern editor', async ({ page }) => {
    await page.click('text=Add Recurring Pattern');

    await expect(page.getByText('Add Recurring Pattern')).toBeVisible();
    await expect(page.getByText('Recurrence Pattern')).toBeVisible();
    await expect(page.getByText('Weekly')).toBeVisible();
    await expect(page.getByText('Bi-weekly (Every 2 weeks)')).toBeVisible();
    await expect(page.getByText('Monthly')).toBeVisible();
  });

  test('should copy week functionality', async ({ page }) => {
    // First create a time block
    const addButtons = page.getByText('Add');
    await addButtons.first().click();

    await page.selectOption('select[id="staff_id"]', 'staff-1');
    await page.selectOption('select[id="day_of_week"]', '1');
    await page.selectOption('select[id="start_time"]', '09:00');
    await page.selectOption('select[id="end_time"]', '17:00');
    await page.click('button[type="submit"]');

    // Wait for the time block to be created
    await expect(page.getByText('9:00 AM - 5:00 PM')).toBeVisible();

    // Click copy week
    await page.click('text=Copy Week');

    // Should show success or create additional time blocks
    // (The exact behavior depends on the implementation)
  });

  test('should show time block details', async ({ page }) => {
    // Create a time block with break
    const addButtons = page.getByText('Add');
    await addButtons.first().click();

    await page.selectOption('select[id="staff_id"]', 'staff-1');
    await page.selectOption('select[id="day_of_week"]', '1');
    await page.selectOption('select[id="start_time"]', '09:00');
    await page.selectOption('select[id="end_time"]', '17:00');

    // Add a break
    await page.click('text=Add Break');
    await page.selectOption('select[id="break_start"]', '12:00');
    await page.selectOption('select[id="break_end"]', '13:00');

    await page.click('button[type="submit"]');

    // Should show break information
    await expect(page.getByText('Break: 12:00 PM - 1:00 PM')).toBeVisible();
  });

  test('should edit existing time blocks', async ({ page }) => {
    // Create a time block first
    const addButtons = page.getByText('Add');
    await addButtons.first().click();

    await page.selectOption('select[id="staff_id"]', 'staff-1');
    await page.selectOption('select[id="day_of_week"]', '1');
    await page.selectOption('select[id="start_time"]', '09:00');
    await page.selectOption('select[id="end_time"]', '17:00');
    await page.click('button[type="submit"]');

    // Wait for the time block to be created
    await expect(page.getByText('9:00 AM - 5:00 PM')).toBeVisible();

    // Hover over the time block to show action buttons
    const timeBlock = page.locator('[data-testid="time-block"]').first();
    await timeBlock.hover();

    // Click edit button
    await page.click('button[title="Edit time block"]');

    // Should open edit modal
    await expect(page.getByText('Edit Time Block')).toBeVisible();
  });

  test('should delete time blocks', async ({ page }) => {
    // Create a time block first
    const addButtons = page.getByText('Add');
    await addButtons.first().click();

    await page.selectOption('select[id="staff_id"]', 'staff-1');
    await page.selectOption('select[id="day_of_week"]', '1');
    await page.selectOption('select[id="start_time"]', '09:00');
    await page.selectOption('select[id="end_time"]', '17:00');
    await page.click('button[type="submit"]');

    // Wait for the time block to be created
    await expect(page.getByText('9:00 AM - 5:00 PM')).toBeVisible();

    // Hover over the time block to show action buttons
    const timeBlock = page.locator('[data-testid="time-block"]').first();
    await timeBlock.hover();

    // Click delete button
    await page.click('button[title="Delete time block"]');

    // Should show confirmation dialog
    await expect(page.getByText('Are you sure you want to delete this time block?')).toBeVisible();

    // Confirm deletion
    await page.click('text=OK');

    // Time block should be removed
    await expect(page.getByText('9:00 AM - 5:00 PM')).not.toBeVisible();
  });

  test('should navigate back to services step', async ({ page }) => {
    await page.click('text=Back to Services');

    // Should navigate to step 3
    await expect(page).toHaveURL('/onboarding/services');
  });

  test('should navigate to next step when continue is clicked', async ({ page }) => {
    // Create at least one time block to make the form valid
    const addButtons = page.getByText('Add');
    await addButtons.first().click();

    await page.selectOption('select[id="staff_id"]', 'staff-1');
    await page.selectOption('select[id="day_of_week"]', '1');
    await page.selectOption('select[id="start_time"]', '09:00');
    await page.selectOption('select[id="end_time"]', '17:00');
    await page.click('button[type="submit"]');

    // Wait for the time block to be created
    await expect(page.getByText('9:00 AM - 5:00 PM')).toBeVisible();

    // Click continue
    await page.click('text=Continue to Policies');

    // Should navigate to step 5
    await expect(page).toHaveURL('/onboarding/step-5');
  });

  test('should show instructions for setting up availability', async ({ page }) => {
    await expect(page.getByText('How to Set Up Availability')).toBeVisible();
    await expect(page.getByText('Adding Time Blocks:')).toBeVisible();
    await expect(page.getByText('Managing Schedules:')).toBeVisible();
  });

  test('should display calendar navigation controls', async ({ page }) => {
    await expect(page.getByText('Today')).toBeVisible();
    await expect(page.locator('button[aria-label="Previous month"]')).toBeVisible();
    await expect(page.locator('button[aria-label="Next month"]')).toBeVisible();
  });

  test('should show current month and year', async ({ page }) => {
    const currentDate = new Date();
    const monthYear = currentDate.toLocaleDateString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    });
    
    await expect(page.getByText(monthYear)).toBeVisible();
  });

  test('should handle drag and drop of time blocks', async ({ page }) => {
    // Create a time block first
    const addButtons = page.getByText('Add');
    await addButtons.first().click();

    await page.selectOption('select[id="staff_id"]', 'staff-1');
    await page.selectOption('select[id="day_of_week"]', '1');
    await page.selectOption('select[id="start_time"]', '09:00');
    await page.selectOption('select[id="end_time"]', '17:00');
    await page.click('button[type="submit"]');

    // Wait for the time block to be created
    await expect(page.getByText('9:00 AM - 5:00 PM')).toBeVisible();

    // Test drag and drop (this would require more complex setup in a real test)
    const timeBlock = page.locator('[data-testid="time-block"]').first();
    const targetDay = page.locator('[data-testid="day-tuesday"]');
    
    // Drag from Monday to Tuesday
    await timeBlock.dragTo(targetDay);

    // The time block should now be on Tuesday
    // (This test would need to be adjusted based on the actual drag and drop implementation)
  });
});
