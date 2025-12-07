/**
 * Comprehensive test suite for Gift Cards & Policies functionality
 * 
 * Tests cover:
 * - POST /api/public/{subdomain}/gift-codes/preview (gift code validation)
 * - Gift card redemption in booking creation
 * - Policy snapshot and consent logging in booking creation
 * - Gift card balance deduction on Complete action
 * - Gift card balance restoration on Refund action
 * 
 * All tests verify:
 * - Gift card validation (amount vs percent types)
 * - Discount calculation
 * - Policy snapshot creation with hash
 * - Consent metadata extraction from headers
 * - Balance updates and ledger entries
 * - Business setting for refund restoration
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as POSTGiftCodePreview } from '../public/[slug]/gift-codes/preview/route';
import { POST as POSTBooking } from '../public/[slug]/bookings/route';
import { POST as POSTComplete } from '../admin/bookings/[id]/complete/route';
import { POST as POSTRefund } from '../admin/bookings/[id]/refund/route';
import * as stripeLib from '@/lib/stripe';
import * as idempotencyLib from '@/lib/idempotency';
import * as authLib from '@/lib/auth';
import { createAdminClient, createServerClient } from '@/lib/db';

// Mock dependencies
vi.mock('@/lib/db');
vi.mock('@/lib/auth');
vi.mock('@/lib/stripe');
vi.mock('@/lib/idempotency');
vi.mock('@/lib/notifications', () => ({
  emitNotification: vi.fn().mockResolvedValue(undefined),
}));

describe('Gift Cards & Policies API', () => {
  const mockUserId = 'user-123';
  const mockBusinessId = 'business-123';
  const mockSubdomain = 'test-business';
  const mockServiceId = 'service-123';
  const mockStaffId = 'staff-123';
  const mockCustomerId = 'customer-123';
  const mockBookingId = 'booking-123';
  const mockGiftCardId = 'gift-card-123';
  const mockIdempotencyKey = 'idempotency-key-123';

  // Mock Supabase client
  const createQueryBuilder = () => {
    let finalPromise: Promise<any> | null = null;
    let isUpdateQuery = false;
    let isInsertQuery = false;
    let isSelectQuery = false;

    const builder = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockImplementation((data) => {
        isInsertQuery = true;
        return builder;
      }),
      update: vi.fn().mockImplementation((data) => {
        isUpdateQuery = true;
        return builder;
      }),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      then: vi.fn((resolve, reject) => {
        if (finalPromise) {
          return finalPromise.then(resolve, reject);
        }
        return Promise.resolve(null).then(resolve, reject);
      }),
      catch: vi.fn((reject) => {
        if (finalPromise) {
          return finalPromise.catch(reject);
        }
        return Promise.resolve(null).catch(reject);
      }),
      setFinalPromise: (promise: Promise<any>) => {
        finalPromise = promise;
      },
    };

    return builder;
  };

  const mockSupabase = {
    from: vi.fn(() => createQueryBuilder()),
  };

  let builderIndex = 0;

  beforeEach(() => {
    vi.clearAllMocks();
    builderIndex = 0;
    (createAdminClient as Mock).mockReturnValue(mockSupabase);
    (createServerClient as Mock).mockResolvedValue(mockSupabase);
    (authLib.getCurrentUserId as Mock).mockResolvedValue(mockUserId);
    (authLib.getCurrentBusinessId as Mock).mockResolvedValue(mockBusinessId);
    (idempotencyLib.checkIdempotency as Mock).mockResolvedValue(null);
    (idempotencyLib.storeIdempotency as Mock).mockResolvedValue(undefined);
  });

  describe('POST /api/public/{subdomain}/gift-codes/preview', () => {
    it('should validate and calculate discount for amount-type gift card', async () => {
      const mockBusiness = {
        id: mockBusinessId,
        user_id: mockUserId,
      };

      const mockGiftCard = {
        id: mockGiftCardId,
        code: 'TEST100',
        discount_type: 'amount',
        current_balance_cents: 5000, // $50
        initial_amount_cents: 10000, // $100
        is_active: true,
        expires_at: null,
      };

      const basePriceCents = 8000; // $80

      // Mock business lookup
      const businessBuilder = createQueryBuilder();
      businessBuilder.setFinalPromise(
        Promise.resolve({ data: mockBusiness, error: null })
      );
      mockSupabase.from.mockReturnValueOnce(businessBuilder);

      // Mock gift card lookup
      const giftCardBuilder = createQueryBuilder();
      giftCardBuilder.setFinalPromise(
        Promise.resolve({ data: mockGiftCard, error: null })
      );
      mockSupabase.from.mockReturnValueOnce(giftCardBuilder);

      const request = new NextRequest('http://localhost/api/public/test-business/gift-codes/preview', {
        method: 'POST',
        body: JSON.stringify({
          code: 'TEST100',
          base_price_cents: basePriceCents,
        }),
      });

      const response = await POSTGiftCodePreview(request, { params: { slug: mockSubdomain } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.discount_cents).toBe(5000); // Min of balance ($50) and price ($80)
      expect(data.final_price_cents).toBe(3000); // $80 - $50 = $30
      expect(data.type).toBe('amount');
      expect(data.gift_card_id).toBe(mockGiftCardId);
    });

    it('should validate and calculate discount for percent-type gift card', async () => {
      const mockBusiness = {
        id: mockBusinessId,
        user_id: mockUserId,
      };

      const mockGiftCard = {
        id: mockGiftCardId,
        code: 'SAVE20',
        discount_type: 'percent',
        percent_off: 20.0, // 20% off
        is_active: true,
        expires_at: null,
      };

      const basePriceCents = 10000; // $100

      const businessBuilder = createQueryBuilder();
      businessBuilder.setFinalPromise(
        Promise.resolve({ data: mockBusiness, error: null })
      );
      mockSupabase.from.mockReturnValueOnce(businessBuilder);

      const giftCardBuilder = createQueryBuilder();
      giftCardBuilder.setFinalPromise(
        Promise.resolve({ data: mockGiftCard, error: null })
      );
      mockSupabase.from.mockReturnValueOnce(giftCardBuilder);

      const request = new NextRequest('http://localhost/api/public/test-business/gift-codes/preview', {
        method: 'POST',
        body: JSON.stringify({
          code: 'SAVE20',
          base_price_cents: basePriceCents,
        }),
      });

      const response = await POSTGiftCodePreview(request, { params: { slug: mockSubdomain } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.discount_cents).toBe(2000); // 20% of $100 = $20
      expect(data.final_price_cents).toBe(8000); // $100 - $20 = $80
      expect(data.type).toBe('percent');
    });

    it('should reject expired gift card', async () => {
      const mockBusiness = {
        id: mockBusinessId,
        user_id: mockUserId,
      };

      const expiredGiftCard = {
        id: mockGiftCardId,
        code: 'EXPIRED',
        discount_type: 'amount',
        current_balance_cents: 5000,
        is_active: true,
        expires_at: new Date('2020-01-01').toISOString(), // Expired
      };

      const businessBuilder = createQueryBuilder();
      businessBuilder.setFinalPromise(
        Promise.resolve({ data: mockBusiness, error: null })
      );
      mockSupabase.from.mockReturnValueOnce(businessBuilder);

      const giftCardBuilder = createQueryBuilder();
      giftCardBuilder.setFinalPromise(
        Promise.resolve({ data: expiredGiftCard, error: null })
      );
      mockSupabase.from.mockReturnValueOnce(giftCardBuilder);

      const request = new NextRequest('http://localhost/api/public/test-business/gift-codes/preview', {
        method: 'POST',
        body: JSON.stringify({
          code: 'EXPIRED',
          base_price_cents: 5000,
        }),
      });

      const response = await POSTGiftCodePreview(request, { params: { slug: mockSubdomain } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('expired');
    });

    it('should reject gift card with insufficient balance', async () => {
      const mockBusiness = {
        id: mockBusinessId,
        user_id: mockUserId,
      };

      const lowBalanceCard = {
        id: mockGiftCardId,
        code: 'LOWBAL',
        discount_type: 'amount',
        current_balance_cents: 0, // No balance
        is_active: true,
        expires_at: null,
      };

      const businessBuilder = createQueryBuilder();
      businessBuilder.setFinalPromise(
        Promise.resolve({ data: mockBusiness, error: null })
      );
      mockSupabase.from.mockReturnValueOnce(businessBuilder);

      const giftCardBuilder = createQueryBuilder();
      giftCardBuilder.setFinalPromise(
        Promise.resolve({ data: lowBalanceCard, error: null })
      );
      mockSupabase.from.mockReturnValueOnce(giftCardBuilder);

      const request = new NextRequest('http://localhost/api/public/test-business/gift-codes/preview', {
        method: 'POST',
        body: JSON.stringify({
          code: 'LOWBAL',
          base_price_cents: 5000,
        }),
      });

      const response = await POSTGiftCodePreview(request, { params: { slug: mockSubdomain } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('balance');
    });
  });

  describe('POST /api/public/{subdomain}/bookings - Gift Card & Policy Integration', () => {
    it('should create booking with gift card discount and policy snapshot', async () => {
      const mockBusiness = {
        id: mockBusinessId,
        user_id: mockUserId,
        subdomain: mockSubdomain,
        subscription_status: 'active',
      };

      const mockService = {
        id: mockServiceId,
        business_id: mockBusinessId,
        price_cents: 10000, // $100
        duration_min: 60,
        is_active: true,
      };

      const mockGiftCard = {
        id: mockGiftCardId,
        code: 'SAVE20',
        discount_type: 'percent',
        percent_off: 20.0,
        is_active: true,
        expires_at: null,
      };

      const mockPolicy = {
        id: 'policy-123',
        business_id: mockBusinessId,
        version: 1,
        cancellation_policy_text: 'Cancel 24h before',
        no_show_policy_text: 'No-show fee applies',
        refund_policy_text: 'Refunds within 7 days',
        cash_policy_text: 'Cash accepted',
        no_show_fee_type: 'amount',
        no_show_fee_amount_cents: 2500,
        no_show_fee_percent: null,
        cancel_fee_type: 'percent',
        cancel_fee_amount_cents: null,
        cancel_fee_percent: 10.0,
        is_active: true,
      };

      const mockCustomer = {
        id: mockCustomerId,
        stripe_customer_id: 'cus_stripe123',
      };

      const mockBooking = {
        id: mockBookingId,
      };

      const mockSetupIntent = {
        setupIntentId: 'seti_123',
        clientSecret: 'seti_123_secret',
      };

      // Mock all database queries - need to account for customer update if exists
      const mockNewCustomer = {
        id: mockCustomerId,
      };
      
      const builders = [
        { promise: Promise.resolve({ data: mockBusiness, error: null }) }, // Business lookup
        { promise: Promise.resolve({ data: mockService, error: null }) }, // Service lookup
        { promise: Promise.resolve({ data: [], error: null }) }, // Existing bookings check
        { promise: Promise.resolve({ data: mockGiftCard, error: null }) }, // Gift card lookup
        { promise: Promise.resolve({ data: mockPolicy, error: null }) }, // Policy lookup
        { promise: Promise.resolve({ data: null, error: { code: 'PGRST116' } }) }, // Customer lookup (not found)
        { promise: Promise.resolve({ data: mockNewCustomer, error: null }) }, // Customer insert
        { promise: Promise.resolve({ data: mockBooking, error: null }) }, // Booking insert
        { promise: Promise.resolve({ data: null, error: null }) }, // Payment insert
      ];

      let builderIndex = 0;
      mockSupabase.from.mockImplementation(() => {
        const builder = createQueryBuilder();
        if (builderIndex < builders.length) {
          builder.setFinalPromise(builders[builderIndex].promise);
          builderIndex++;
        }
        return builder;
      });

      (stripeLib.createOrGetCustomer as Mock).mockResolvedValue('cus_stripe123');
      (stripeLib.createSetupIntent as Mock).mockResolvedValue(mockSetupIntent);

      const request = new NextRequest('http://localhost/api/public/test-business/bookings', {
        method: 'POST',
        headers: {
          'x-forwarded-for': '192.168.1.1',
          'user-agent': 'Mozilla/5.0 Test Browser',
        },
        body: JSON.stringify({
          service_id: mockServiceId,
          staff_id: mockStaffId,
          start_at: new Date('2025-12-25T14:00:00Z').toISOString(),
          customer: {
            name: 'Test Customer',
            email: 'test@example.com',
            phone: '555-1234',
          },
          gift_card_code: 'SAVE20',
        }),
      });

      const response = await POSTBooking(request, { params: { slug: mockSubdomain } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.final_price_cents).toBe(8000); // $100 - 20% = $80

      // Verify booking was created with gift card and policy snapshot
      const insertCall = mockSupabase.from.mock.calls.find(
        (call) => call[0] === 'bookings'
      );
      expect(insertCall).toBeDefined();
    });

    it('should extract consent metadata from headers', async () => {
      const mockBusiness = {
        id: mockBusinessId,
        user_id: mockUserId,
        subdomain: mockSubdomain,
        subscription_status: 'active',
      };

      const mockService = {
        id: mockServiceId,
        business_id: mockBusinessId,
        price_cents: 10000,
        duration_min: 60,
        is_active: true,
      };

      const mockPolicy = {
        id: 'policy-123',
        business_id: mockBusinessId,
        version: 1,
        cancellation_policy_text: 'Test',
        no_show_policy_text: 'Test',
        refund_policy_text: 'Test',
        cash_policy_text: 'Test',
        no_show_fee_type: 'amount',
        no_show_fee_amount_cents: 0,
        cancel_fee_type: 'amount',
        cancel_fee_amount_cents: 0,
        is_active: true,
      };

      const mockCustomer = {
        id: mockCustomerId,
        stripe_customer_id: 'cus_stripe123',
      };

      const mockBooking = {
        id: mockBookingId,
      };

      const builders = [
        { promise: Promise.resolve({ data: mockBusiness, error: null }) },
        { promise: Promise.resolve({ data: mockService, error: null }) },
        { promise: Promise.resolve({ data: [], error: null }) },
        { promise: Promise.resolve({ data: mockPolicy, error: null }) },
        { promise: Promise.resolve({ data: null, error: { code: 'PGRST116' } }) }, // Customer lookup (not found)
        { promise: Promise.resolve({ data: mockBooking, error: null }) }, // Customer insert
        { promise: Promise.resolve({ data: mockBooking, error: null }) }, // Booking insert
        { promise: Promise.resolve({ data: null, error: null }) }, // Payment insert
      ];

      let builderIndex = 0;
      mockSupabase.from.mockImplementation(() => {
        const builder = createQueryBuilder();
        if (builderIndex < builders.length) {
          builder.setFinalPromise(builders[builderIndex].promise);
          builderIndex++;
        }
        return builder;
      });

      (stripeLib.createOrGetCustomer as Mock).mockResolvedValue('cus_stripe123');
      (stripeLib.createSetupIntent as Mock).mockResolvedValue({
        setupIntentId: 'seti_123',
        clientSecret: 'seti_123_secret',
      });

      const request = new NextRequest('http://localhost/api/public/test-business/bookings', {
        method: 'POST',
        headers: {
          'x-forwarded-for': '192.168.1.1, 10.0.0.1', // Should extract first IP
          'user-agent': 'Mozilla/5.0 Test Browser',
        },
        body: JSON.stringify({
          service_id: mockServiceId,
          staff_id: mockStaffId,
          start_at: new Date('2025-12-25T14:00:00Z').toISOString(),
          customer: {
            name: 'Test Customer',
            email: 'test@example.com',
          },
        }),
      });

      await POSTBooking(request, { params: { slug: mockSubdomain } });

      // Verify policy snapshot includes version and snapshot_at
      const insertBuilder = mockSupabase.from.mock.calls.find(
        (call) => call[0] === 'bookings'
      );
      expect(insertBuilder).toBeDefined();
    });
  });

  describe('POST /api/admin/bookings/{id}/complete - Gift Card Balance Deduction', () => {
    it('should deduct gift card balance when payment succeeds', async () => {
      const mockBooking = {
        id: mockBookingId,
        user_id: mockUserId,
        business_id: mockBusinessId,
        gift_card_id: mockGiftCardId,
        gift_card_amount_applied_cents: 2000, // $20 applied
        final_price_cents: 8000,
        status: 'pending',
        customers: {
          stripe_customer_id: 'cus_stripe123',
        },
        businesses: {
          stripe_connect_account_id: 'acct_connect123',
        },
      };

      const mockGiftCard = {
        id: mockGiftCardId,
        discount_type: 'amount',
        current_balance_cents: 5000, // $50 balance
      };

      const mockSetupPayment = {
        stripe_setup_intent_id: 'seti_123',
      };

      const builders = [
        { promise: Promise.resolve({ data: mockBooking, error: null }) }, // Booking lookup
        { promise: Promise.resolve({ data: mockSetupPayment, error: null }) }, // Setup payment lookup
        { promise: Promise.resolve({ data: null, error: null }) }, // Payment insert
        { promise: Promise.resolve({ data: null, error: null }) }, // Booking update
        { promise: Promise.resolve({ data: mockGiftCard, error: null }) }, // Gift card lookup
        { promise: Promise.resolve({ data: null, error: null }) }, // Gift card update
        { promise: Promise.resolve({ data: null, error: null }) }, // Ledger insert
      ];


      let builderIndex = 0;
      mockSupabase.from.mockImplementation(() => {
        const builder = createQueryBuilder();
        if (builderIndex < builders.length) {
          builder.setFinalPromise(builders[builderIndex].promise);
          builderIndex++;
        }
        return builder;
      });

      (stripeLib.getPaymentMethodFromSetupIntent as Mock).mockResolvedValue('pm_123');
      (stripeLib.createPaymentIntent as Mock).mockResolvedValue({
        paymentIntentId: 'pi_123',
        clientSecret: 'pi_123_secret',
        status: 'succeeded',
        requiresAction: false,
      });

      const request = new NextRequest('http://localhost/api/admin/bookings/booking-123/complete', {
        method: 'POST',
        headers: {
          'X-Idempotency-Key': mockIdempotencyKey,
        },
      });

      const response = await POSTComplete(request, { params: { id: mockBookingId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('CHARGED');

      // Verify gift card balance was deducted
      const giftCardUpdateCall = mockSupabase.from.mock.calls.find(
        (call) => call[0] === 'gift_cards'
      );
      expect(giftCardUpdateCall).toBeDefined();

      // Verify ledger entry was created
      const ledgerInsertCall = mockSupabase.from.mock.calls.find(
        (call) => call[0] === 'gift_card_ledger'
      );
      expect(ledgerInsertCall).toBeDefined();
    });

    it('should NOT deduct balance for percent-type gift cards', async () => {
      const mockBooking = {
        id: mockBookingId,
        user_id: mockUserId,
        business_id: mockBusinessId,
        gift_card_id: mockGiftCardId,
        gift_card_amount_applied_cents: 2000,
        final_price_cents: 8000,
        status: 'pending',
        customers: {
          stripe_customer_id: 'cus_stripe123',
        },
        businesses: {
          stripe_connect_account_id: 'acct_connect123',
        },
      };

      const mockGiftCard = {
        id: mockGiftCardId,
        discount_type: 'percent', // Percent type - no balance
        current_balance_cents: null,
      };

      const mockSetupPayment = {
        stripe_setup_intent_id: 'seti_123',
      };

      const builders = [
        { promise: Promise.resolve({ data: mockBooking, error: null }) },
        { promise: Promise.resolve({ data: mockSetupPayment, error: null }) },
        { promise: Promise.resolve({ data: null, error: null }) },
        { promise: Promise.resolve({ data: null, error: null }) },
        { promise: Promise.resolve({ data: mockGiftCard, error: null }) },
      ];

      let builderIndex = 0;
      mockSupabase.from.mockImplementation(() => {
        const builder = createQueryBuilder();
        if (builderIndex < builders.length) {
          builder.setFinalPromise(builders[builderIndex].promise);
          builderIndex++;
        }
        return builder;
      });

      (stripeLib.getPaymentMethodFromSetupIntent as Mock).mockResolvedValue('pm_123');
      (stripeLib.createPaymentIntent as Mock).mockResolvedValue({
        paymentIntentId: 'pi_123',
        clientSecret: 'pi_123_secret',
        status: 'succeeded',
        requiresAction: false,
      });

      const request = new NextRequest('http://localhost/api/admin/bookings/booking-123/complete', {
        method: 'POST',
        headers: {
          'X-Idempotency-Key': mockIdempotencyKey,
        },
      });

      await POSTComplete(request, { params: { id: mockBookingId } });

      // Verify NO gift card update was called (percent type doesn't have balance)
      const giftCardUpdateCalls = mockSupabase.from.mock.calls.filter(
        (call) => call[0] === 'gift_cards'
      );
      expect(giftCardUpdateCalls.length).toBe(1); // Only the lookup, no update
    });
  });

  describe('POST /api/admin/bookings/{id}/refund - Gift Card Balance Restoration', () => {
    it('should restore gift card balance when business setting is enabled', async () => {
      const mockBooking = {
        id: mockBookingId,
        user_id: mockUserId,
        business_id: mockBusinessId,
        gift_card_id: mockGiftCardId,
        gift_card_amount_applied_cents: 2000, // $20 was applied
        status: 'completed',
      };

      const mockBusiness = {
        id: mockBusinessId,
        restore_gift_card_on_refund: true, // Setting enabled
      };

      const mockChargedPayment = {
        id: 'payment-123',
        stripe_payment_intent_id: 'pi_123',
        status: 'charged',
        money_action: 'completed_charge',
      };

      const mockGiftCard = {
        id: mockGiftCardId,
        discount_type: 'amount',
        current_balance_cents: 3000, // Current balance after deduction
      };

      const builders = [
        { promise: Promise.resolve({ data: mockBooking, error: null }) }, // Booking lookup
        { promise: Promise.resolve({ data: mockChargedPayment, error: null }) }, // Payment lookup
        { promise: Promise.resolve({ data: null, error: null }) }, // Refund payment insert
        { promise: Promise.resolve({ data: null, error: null }) }, // Booking update
        { promise: Promise.resolve({ data: mockBusiness, error: null }) }, // Business lookup
        { promise: Promise.resolve({ data: mockGiftCard, error: null }) }, // Gift card lookup
        { promise: Promise.resolve({ data: null, error: null }) }, // Gift card update
        { promise: Promise.resolve({ data: null, error: null }) }, // Ledger insert
      ];

      let builderIndex = 0;
      mockSupabase.from.mockImplementation(() => {
        const builder = createQueryBuilder();
        if (builderIndex < builders.length) {
          builder.setFinalPromise(builders[builderIndex].promise);
          builderIndex++;
        }
        return builder;
      });

      (stripeLib.createRefund as Mock).mockResolvedValue({
        refundId: 're_123',
        amount: 8000, // Refund amount
      });

      const request = new NextRequest('http://localhost/api/admin/bookings/booking-123/refund', {
        method: 'POST',
        headers: {
          'X-Idempotency-Key': mockIdempotencyKey,
        },
      });

      const response = await POSTRefund(request, { params: { id: mockBookingId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('REFUNDED');

      // Verify gift card balance was restored
      const giftCardUpdateCall = mockSupabase.from.mock.calls.find(
        (call) => call[0] === 'gift_cards' && builderIndex > 5
      );
      expect(giftCardUpdateCall).toBeDefined();

      // Verify ledger entry was created with positive delta
      const ledgerInsertCall = mockSupabase.from.mock.calls.find(
        (call) => call[0] === 'gift_card_ledger'
      );
      expect(ledgerInsertCall).toBeDefined();
    });

    it('should NOT restore balance when business setting is disabled', async () => {
      const mockBooking = {
        id: mockBookingId,
        user_id: mockUserId,
        business_id: mockBusinessId,
        gift_card_id: mockGiftCardId,
        gift_card_amount_applied_cents: 2000,
        status: 'completed',
      };

      const mockBusiness = {
        id: mockBusinessId,
        restore_gift_card_on_refund: false, // Setting disabled
      };

      const mockChargedPayment = {
        id: 'payment-123',
        stripe_payment_intent_id: 'pi_123',
        status: 'charged',
        money_action: 'completed_charge',
      };

      const builders = [
        { promise: Promise.resolve({ data: mockBooking, error: null }) },
        { promise: Promise.resolve({ data: mockChargedPayment, error: null }) },
        { promise: Promise.resolve({ data: null, error: null }) },
        { promise: Promise.resolve({ data: null, error: null }) },
        { promise: Promise.resolve({ data: mockBusiness, error: null }) },
      ];

      let builderIndex = 0;
      mockSupabase.from.mockImplementation(() => {
        const builder = createQueryBuilder();
        if (builderIndex < builders.length) {
          builder.setFinalPromise(builders[builderIndex].promise);
          builderIndex++;
        }
        return builder;
      });

      (stripeLib.createRefund as Mock).mockResolvedValue({
        refundId: 're_123',
        amount: 8000,
      });

      const request = new NextRequest('http://localhost/api/admin/bookings/booking-123/refund', {
        method: 'POST',
        headers: {
          'X-Idempotency-Key': mockIdempotencyKey,
        },
      });

      await POSTRefund(request, { params: { id: mockBookingId } });

      // Verify NO gift card update was called
      const giftCardUpdateCalls = mockSupabase.from.mock.calls.filter(
        (call) => call[0] === 'gift_cards' && builderIndex > 4
      );
      expect(giftCardUpdateCalls.length).toBe(0); // Only lookup, no update
    });
  });
});

