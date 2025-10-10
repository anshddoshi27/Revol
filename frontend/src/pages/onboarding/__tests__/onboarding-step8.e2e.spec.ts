/**
 * Onboarding Step 8 E2E Tests
 * 
 * End-to-end tests for the complete payment setup and go-live flow.
 */

import { test, expect } from '@playwright/test';

test.describe('Onboarding Step 8 - Payments & Go Live', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the API responses
    await page.route('**/api/v1/admin/payments/setup-intent', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          setup_intent: {
            id: 'seti_test123',
            client_secret: 'seti_test123_secret',
            status: 'requires_payment_method',
            created: Date.now(),
          },
          client_secret: 'seti_test123_secret',
        }),
      });
    });

    await page.route('**/api/v1/admin/payments/wallets/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          cards: true,
          apple_pay: false,
          google_pay: false,
          paypal: false,
          cash: false,
          cash_requires_card: false,
        }),
      });
    });

    await page.route('**/api/v1/admin/payments/kyc/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'kyc_test123',
          tenant_id: 'test-tenant',
          legal_name: 'Test Business LLC',
          representative_name: 'John Doe',
          representative_email: 'john@testbusiness.com',
          representative_phone: '+1234567890',
          business_type: 'llc',
          address: {
            street: '123 Test St',
            city: 'Test City',
            state_province: 'TS',
            postal_code: '12345',
            country: 'US',
          },
          payout_destination: {
            type: 'bank_account',
            account_holder_name: 'Test Business LLC',
            account_holder_type: 'company',
            routing_number: '123456789',
            account_number: '987654321',
          },
          statement_descriptor: 'TEST BUSINESS',
          tax_display: 'inclusive',
          currency: 'USD',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });
    });

    await page.route('**/api/v1/admin/payments/go-live/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          business_name: 'Test Business',
          booking_url: 'https://test-business.tithi.app',
          admin_url: 'https://admin.tithi.app/test-business',
          go_live_date: new Date().toISOString(),
        }),
      });
    });

    // Navigate to the payments step with mock data
    await page.goto('/onboarding/payments', {
      state: {
        step1Data: {
          name: 'Test Business',
          slug: 'test-tenant',
        },
        step7Data: {
          giftCardConfig: {
            is_enabled: false,
            denominations: [],
            expiration_policy: '1 year from purchase',
          },
        },
      },
    });
  });

  test('completes payment setup flow', async ({ page }) => {
    // Wait for payment setup form to load
    await expect(page.getByText('Payment Setup')).toBeVisible();
    await expect(page.getByText('Subscription Plan')).toBeVisible();

    // Check subscription information
    await expect(page.getByText('You\'ll be charged $11.99/month for your Tithi subscription.')).toBeVisible();

    // Check consent checkboxes
    await page.check('input[name="subscription_consent"]');
    await page.check('input[name="terms_consent"]');
    await page.check('input[name="privacy_consent"]');

    // Mock Stripe confirmation
    await page.route('**/confirmCardSetup', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          error: null,
          setupIntent: {
            id: 'seti_test123',
            status: 'succeeded',
            payment_method: 'pm_test123',
          },
        }),
      });
    });

    // Submit payment setup
    await page.click('button:has-text("Setup Payment Method")');

    // Should move to wallet configuration
    await expect(page.getByText('Payment Methods')).toBeVisible();
    await expect(page.getByText('Choose which payment methods your customers can use')).toBeVisible();
  });

  test('configures wallet options', async ({ page }) => {
    // Complete payment setup first
    await page.check('input[name="subscription_consent"]');
    await page.check('input[name="terms_consent"]');
    await page.check('input[name="privacy_consent"]');
    await page.click('button:has-text("Setup Payment Method")');

    // Wait for wallet configuration
    await expect(page.getByText('Payment Methods')).toBeVisible();

    // Enable additional payment methods
    await page.check('input[name="apple_pay"]');
    await page.check('input[name="google_pay"]');
    await page.check('input[name="cash"]');

    // Should show cash payment warning
    await expect(page.getByText('Cash Payment Policy')).toBeVisible();
    await expect(page.getByText('customers must provide a card on file')).toBeVisible();

    // Check payment method summary
    await expect(page.getByText(/Customers will be able to pay using: Credit\/Debit Cards, Apple Pay, Google Pay, Cash Payments/)).toBeVisible();

    // Should move to KYC form
    await page.click('button:has-text("Continue")');
    await expect(page.getByText('Business Verification')).toBeVisible();
  });

  test('completes KYC form', async ({ page }) => {
    // Complete previous steps
    await page.check('input[name="subscription_consent"]');
    await page.check('input[name="terms_consent"]');
    await page.check('input[name="privacy_consent"]');
    await page.click('button:has-text("Setup Payment Method")');
    await page.click('button:has-text("Continue")');

    // Wait for KYC form
    await expect(page.getByText('Business Verification')).toBeVisible();

    // Fill out business information
    await page.fill('input[name="legal_name"]', 'Test Business LLC');
    await page.fill('input[name="dba_name"]', 'Test Business');
    await page.selectOption('select[name="business_type"]', 'llc');
    await page.fill('input[name="tax_id"]', '123456789');

    // Fill out representative information
    await page.fill('input[name="representative_name"]', 'John Doe');
    await page.fill('input[name="representative_email"]', 'john@testbusiness.com');
    await page.fill('input[name="representative_phone"]', '+1234567890');

    // Fill out address
    await page.fill('input[name="address.street"]', '123 Test Street');
    await page.fill('input[name="address.city"]', 'Test City');
    await page.fill('input[name="address.state_province"]', 'TS');
    await page.fill('input[name="address.postal_code"]', '12345');

    // Fill out payout destination
    await page.fill('input[name="payout_destination.account_holder_name"]', 'Test Business LLC');
    await page.fill('input[name="payout_destination.routing_number"]', '123456789');
    await page.fill('input[name="payout_destination.account_number"]', '987654321');

    // Fill out payment settings
    await page.fill('input[name="statement_descriptor"]', 'TEST BUSINESS');
    await page.selectOption('select[name="tax_display"]', 'inclusive');

    // Should move to go-live step
    await page.click('button:has-text("Continue")');
    await expect(page.getByText('Ready to Go Live!')).toBeVisible();
  });

  test('completes go-live flow', async ({ page }) => {
    // Complete all previous steps
    await page.check('input[name="subscription_consent"]');
    await page.check('input[name="terms_consent"]');
    await page.check('input[name="privacy_consent"]');
    await page.click('button:has-text("Setup Payment Method")');
    await page.click('button:has-text("Continue")');

    // Fill KYC form quickly
    await page.fill('input[name="legal_name"]', 'Test Business LLC');
    await page.fill('input[name="representative_name"]', 'John Doe');
    await page.fill('input[name="representative_email"]', 'john@testbusiness.com');
    await page.fill('input[name="representative_phone"]', '+1234567890');
    await page.fill('input[name="address.street"]', '123 Test Street');
    await page.fill('input[name="address.city"]', 'Test City');
    await page.fill('input[name="address.state_province"]', 'TS');
    await page.fill('input[name="address.postal_code"]', '12345');
    await page.fill('input[name="payout_destination.account_holder_name"]', 'Test Business LLC');
    await page.fill('input[name="payout_destination.routing_number"]', '123456789');
    await page.fill('input[name="payout_destination.account_number"]', '987654321');
    await page.fill('input[name="statement_descriptor"]', 'TEST BUSINESS');
    await page.click('button:has-text("Continue")');

    // Wait for go-live step
    await expect(page.getByText('Ready to Go Live!')).toBeVisible();
    await expect(page.getByText('What happens when you go live?')).toBeVisible();

    // Click go live button
    await page.click('button:has-text("Go Live Now!")');

    // Should show go-live modal
    await expect(page.getByText('Ready to Go Live?')).toBeVisible();
    await expect(page.getByText('You\'re about to make Test Business live')).toBeVisible();

    // Check all consent boxes in modal
    await page.check('input[name="consent_terms"]');
    await page.check('input[name="consent_privacy"]');
    await page.check('input[name="consent_subscription"]');
    await page.check('input[name="confirm_go_live"]');

    // Confirm go live
    await page.click('button:has-text("Go Live!")');

    // Should show success screen
    await expect(page.getByText('Test Business IS LIVE!')).toBeVisible();
    await expect(page.getByText('🎉')).toBeVisible();
    await expect(page.getByText('Your booking site is now live')).toBeVisible();
  });

  test('shows success screen with correct links', async ({ page }) => {
    // Complete the entire flow
    await page.check('input[name="subscription_consent"]');
    await page.check('input[name="terms_consent"]');
    await page.check('input[name="privacy_consent"]');
    await page.click('button:has-text("Setup Payment Method")');
    await page.click('button:has-text("Continue")');

    // Fill KYC form
    await page.fill('input[name="legal_name"]', 'Test Business LLC');
    await page.fill('input[name="representative_name"]', 'John Doe');
    await page.fill('input[name="representative_email"]', 'john@testbusiness.com');
    await page.fill('input[name="representative_phone"]', '+1234567890');
    await page.fill('input[name="address.street"]', '123 Test Street');
    await page.fill('input[name="address.city"]', 'Test City');
    await page.fill('input[name="address.state_province"]', 'TS');
    await page.fill('input[name="address.postal_code"]', '12345');
    await page.fill('input[name="payout_destination.account_holder_name"]', 'Test Business LLC');
    await page.fill('input[name="payout_destination.routing_number"]', '123456789');
    await page.fill('input[name="payout_destination.account_number"]', '987654321');
    await page.fill('input[name="statement_descriptor"]', 'TEST BUSINESS');
    await page.click('button:has-text("Continue")');

    // Go live
    await page.click('button:has-text("Go Live Now!")');
    await page.check('input[name="consent_terms"]');
    await page.check('input[name="consent_privacy"]');
    await page.check('input[name="consent_subscription"]');
    await page.check('input[name="confirm_go_live"]');
    await page.click('button:has-text("Go Live!")');

    // Check success screen elements
    await expect(page.getByText('Test Business IS LIVE!')).toBeVisible();
    await expect(page.getByText('Booking Site')).toBeVisible();
    await expect(page.getByText('Admin Dashboard')).toBeVisible();
    await expect(page.getByText('https://test-business.tithi.app')).toBeVisible();
    await expect(page.getByText('https://admin.tithi.app/test-business')).toBeVisible();

    // Check next steps
    await expect(page.getByText('What\'s Next?')).toBeVisible();
    await expect(page.getByText('Share Your Booking Link')).toBeVisible();
    await expect(page.getByText('Monitor Your Bookings')).toBeVisible();
    await expect(page.getByText('Customize Your Experience')).toBeVisible();
    await expect(page.getByText('Get Support')).toBeVisible();
  });

  test('handles validation errors', async ({ page }) => {
    // Try to submit payment setup without consent
    await page.click('button:has-text("Setup Payment Method")');

    // Should show validation errors
    await expect(page.getByText('You must agree to the subscription terms')).toBeVisible();
    await expect(page.getByText('You must agree to the terms of service')).toBeVisible();
    await expect(page.getByText('You must agree to the privacy policy')).toBeVisible();

    // Check boxes and try again
    await page.check('input[name="subscription_consent"]');
    await page.check('input[name="terms_consent"]');
    await page.check('input[name="privacy_consent"]');

    // Errors should be cleared
    await expect(page.getByText('You must agree to the subscription terms')).not.toBeVisible();
  });

  test('handles API errors gracefully', async ({ page }) => {
    // Mock API error
    await page.route('**/api/v1/admin/payments/setup-intent', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Internal server error',
        }),
      });
    });

    await page.reload();

    // Should show error message
    await expect(page.getByText('Error')).toBeVisible();
    await expect(page.getByText('Failed to create payment setup')).toBeVisible();
  });
});

