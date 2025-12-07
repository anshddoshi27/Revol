/**
 * Mock Stripe client for unit tests
 * Simulates success, decline, and requires_action scenarios
 */

import { vi } from 'vitest';

export const mockStripeClient = {
  accounts: {
    create: vi.fn(),
    retrieve: vi.fn(),
  },
  accountLinks: {
    create: vi.fn(),
  },
  customers: {
    create: vi.fn(),
    list: vi.fn(),
    retrieve: vi.fn(),
  },
  setupIntents: {
    create: vi.fn(),
    retrieve: vi.fn(),
  },
  paymentIntents: {
    create: vi.fn(),
    retrieve: vi.fn(),
    update: vi.fn(),
  },
  subscriptions: {
    create: vi.fn(),
    retrieve: vi.fn(),
    update: vi.fn(),
    cancel: vi.fn(),
  },
  refunds: {
    create: vi.fn(),
  },
  invoices: {
    retrieve: vi.fn(),
    list: vi.fn(),
  },
};

// Default success responses
mockStripeClient.accounts.create.mockResolvedValue({
  id: 'acct_test123',
  type: 'express',
  email: 'test@example.com',
  details_submitted: true,
  charges_enabled: true,
});

mockStripeClient.accounts.retrieve.mockResolvedValue({
  id: 'acct_test123',
  details_submitted: true,
  charges_enabled: true,
});

mockStripeClient.accountLinks.create.mockResolvedValue({
  url: 'https://connect.stripe.com/setup/test',
});

mockStripeClient.customers.create.mockResolvedValue({
  id: 'cus_test123',
  email: 'test@example.com',
  name: 'Test Customer',
});

mockStripeClient.customers.list.mockResolvedValue({
  data: [],
});

mockStripeClient.setupIntents.create.mockResolvedValue({
  id: 'seti_test123',
  client_secret: 'seti_test123_secret_test',
  status: 'succeeded',
  payment_method: 'pm_test123',
});

mockStripeClient.setupIntents.retrieve.mockResolvedValue({
  id: 'seti_test123',
  payment_method: 'pm_test123',
  status: 'succeeded',
});

mockStripeClient.paymentIntents.create.mockResolvedValue({
  id: 'pi_test123',
  client_secret: 'pi_test123_secret_test',
  status: 'succeeded',
});

mockStripeClient.paymentIntents.retrieve.mockResolvedValue({
  id: 'pi_test123',
  status: 'succeeded',
  amount: 10000,
});

mockStripeClient.subscriptions.create.mockResolvedValue({
  id: 'sub_test123',
  status: 'trialing',
  current_period_end: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
  trial_end: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
});

mockStripeClient.refunds.create.mockResolvedValue({
  id: 're_test123',
  amount: 10000,
  status: 'succeeded',
});

// Helper functions to simulate different scenarios
export const simulateStripeSuccess = () => {
  mockStripeClient.paymentIntents.create.mockResolvedValueOnce({
    id: 'pi_test123',
    client_secret: 'pi_test123_secret_test',
    status: 'succeeded',
  });
};

export const simulateStripeDecline = () => {
  const error = new Error('Your card was declined.');
  (error as any).type = 'StripeCardError';
  (error as any).code = 'card_declined';
  mockStripeClient.paymentIntents.create.mockRejectedValueOnce(error);
};

export const simulateStripeRequiresAction = () => {
  mockStripeClient.paymentIntents.create.mockResolvedValueOnce({
    id: 'pi_test123',
    client_secret: 'pi_test123_secret_test',
    status: 'requires_action',
  });
};

export const simulateStripeTimeout = () => {
  const error = new Error('Request timeout');
  (error as any).type = 'StripeConnectionError';
  mockStripeClient.paymentIntents.create.mockRejectedValueOnce(error);
};

// Reset all mocks
export const resetStripeMocks = () => {
  vi.clearAllMocks();
  // Reset to default success responses
  simulateStripeSuccess();
};

