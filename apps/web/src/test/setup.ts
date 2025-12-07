/**
 * Test setup file for Vitest
 * Configures global test environment
 */

import { vi } from 'vitest';

// Mock Next.js headers and cookies
vi.mock('next/headers', () => ({
  headers: vi.fn(() => Promise.resolve(new Headers())),
  cookies: vi.fn(() => Promise.resolve({
    get: vi.fn(),
    set: vi.fn(),
  })),
}));

// Mock Stripe - use dynamic import for ESM compatibility
vi.mock('stripe', async () => {
  const { mockStripeClient } = await import('./__mocks__/stripe');
  return {
    default: vi.fn(() => mockStripeClient),
  };
});

// Mock global fetch for SendGrid and Twilio
global.fetch = vi.fn();

// Set up environment variables for tests
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-key';
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_test';
process.env.SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || 'SG.test';
process.env.TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || 'AC_test';
process.env.TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || 'test_token';

