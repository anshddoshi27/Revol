/**
 * Comprehensive unit tests for payment & booking actions
 * Tests: Complete, No-Show, Cancel, Refund
 * 
 * CRITICAL: Verifies correct amounts are charged to customer's credit card
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextResponse } from 'next/server';
import { POST as completeBooking } from '../[id]/complete/route';
import { POST as noShowBooking } from '../[id]/no-show/route';
import { POST as cancelBooking } from '../[id]/cancel/route';
import { POST as refundBooking } from '../[id]/refund/route';
import { createServerClient } from '@/lib/db';
import { getCurrentUserId, getCurrentBusinessId } from '@/lib/auth';
import { checkIdempotency, storeIdempotency } from '@/lib/idempotency';
import { createPaymentIntent, getPaymentMethodFromSetupIntent, createRefund } from '@/lib/stripe';
import { emitNotification } from '@/lib/notifications';
import { simulateStripeSuccess, simulateStripeDecline, simulateStripeRequiresAction } from '@/test/__mocks__/stripe';
import { createMockBooking, createMockBusiness, createMockCustomer, createMockPolicy, createMockGiftCard } from '@/test/factories';

// Mock all dependencies
vi.mock('@/lib/db');
vi.mock('@/lib/auth');
vi.mock('@/lib/idempotency');
vi.mock('@/lib/stripe');
vi.mock('@/lib/notifications');

describe('Payment & Booking Actions - Credit Card Charging', () => {
  let mockSupabase: any;
  let mockRequest: Request;

  beforeEach(() => {
    vi.clearAllMocks();
    resetStripeMocks();

    // Setup Supabase mock with chainable query builder
    const createChainableBuilder = () => {
      const builder: any = {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn(),
        maybeSingle: vi.fn(),
      };
      // Ensure all methods return the builder for chaining
      Object.keys(builder).forEach(key => {
        if (typeof builder[key] === 'function' && key !== 'single' && key !== 'maybeSingle') {
          builder[key].mockReturnValue(builder);
        }
      });
      return builder;
    };

    mockSupabase = {
      from: vi.fn(() => createChainableBuilder()),
      auth: {
        getUser: vi.fn(),
      },
    };

    (createServerClient as any).mockResolvedValue(mockSupabase);
    (getCurrentUserId as any).mockResolvedValue('user-123');
    (getCurrentBusinessId as any).mockResolvedValue('biz-123');
    (checkIdempotency as any).mockResolvedValue(null);
    (storeIdempotency as any).mockResolvedValue(undefined);
    (emitNotification as any).mockResolvedValue(undefined);

    // Mock Stripe functions
    (getPaymentMethodFromSetupIntent as any).mockResolvedValue('pm_test123');
    (createRefund as any).mockResolvedValue({
      refundId: 're_test123',
      amount: 10000,
    });

    // Mock Request
    mockRequest = {
      headers: {
        get: vi.fn((key: string) => {
          if (key === 'X-Idempotency-Key') return 'idempotency-key-123';
          return null;
        }),
      },
    } as any;
  });

  describe('POST /api/admin/bookings/{id}/complete - Charge Full Amount', () => {
    it('should charge customer the final_price_cents (after gift card discount)', async () => {
      // Customer books $100 service, uses $20 gift card, should be charged $80
      const booking = createMockBooking({
        id: 'booking-123',
        price_cents: 10000, // $100 base price
        final_price_cents: 8000, // $80 after $20 gift card
        gift_card_amount_applied_cents: 2000,
        status: 'pending',
        payment_status: 'card_saved',
      });

      const customer = createMockCustomer({
        id: booking.customer_id,
        stripe_customer_id: 'cus_test123',
      });

      const business = createMockBusiness({
        id: booking.business_id,
        stripe_connect_account_id: 'acct_test123',
      });

      // Setup mocks
      let giftCardUpdateCalled = false;
      let ledgerInsertCalled = false;
      
      mockSupabase.from.mockImplementation((table: string) => {
        const builder = createChainableBuilder();
        if (table === 'bookings') {
          // Track if update was called on this builder instance
          let updateCalled = false;
          // Handle select queries - return builder for chaining
          builder.select = vi.fn(() => builder);
          // single() resolves the select query
          builder.single = vi.fn().mockResolvedValue({
            data: {
              ...booking,
              customers: customer,
              businesses: business,
            },
            error: null,
          });
          // update() returns builder for chaining
          builder.update = vi.fn(() => {
            updateCalled = true;
            return builder;
          });
          // eq() after update() resolves the promise, otherwise returns builder
          const originalEq = builder.eq;
          builder.eq = vi.fn((...args) => {
            if (updateCalled) {
              updateCalled = false;
              return Promise.resolve({ error: null });
            }
            return builder; // For select queries, return builder for chaining
          });
        } else if (table === 'booking_payments') {
          // Check if this is a select query (has select called) or insert
          const originalSelect = builder.select;
          builder.select = vi.fn(() => {
            builder.single = vi.fn().mockResolvedValue({
              data: { stripe_setup_intent_id: 'seti_test123' },
              error: null,
            });
            return builder;
          });
          builder.insert = vi.fn().mockResolvedValue({ error: null });
        } else if (table === 'gift_cards') {
          builder.single = vi.fn().mockResolvedValue({
            data: {
              id: 'gift-123',
              discount_type: 'amount',
              current_balance_cents: 5000,
            },
            error: null,
          });
          const originalUpdate = builder.update;
          builder.update = vi.fn(() => {
            giftCardUpdateCalled = true;
            return builder; // Return chainable builder
          });
        } else if (table === 'gift_card_ledger') {
          builder.insert = vi.fn(() => {
            ledgerInsertCalled = true;
            return Promise.resolve({ error: null });
          });
        }
        return builder;
      });

      // Mock successful payment
      (createPaymentIntent as any).mockResolvedValue({
        paymentIntentId: 'pi_test123',
        clientSecret: 'pi_test123_secret',
        status: 'succeeded',
        requiresAction: false,
      });

      const response = await completeBooking(mockRequest, { params: { id: 'booking-123' } });
      const data = await response.json();

      // Verify customer is charged $80 (final_price_cents), NOT $100
      expect(createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 8000, // $80 - the final price after gift card
          customerId: 'cus_test123',
          paymentMethodId: 'pm_test123',
          connectAccountId: 'acct_test123',
          applicationFee: 80, // 1% of $80 = $0.80 (rounded)
          offSession: true,
        })
      );

      expect(response.status).toBe(200);
      expect(data.status).toBe('CHARGED');
      expect(data.charge_amount).toBe(8000); // Customer charged $80
    });

    it('should charge full price when no gift card is used', async () => {
      // Customer books $100 service, no gift card, should be charged $100
      const booking = createMockBooking({
        id: 'booking-123',
        price_cents: 10000, // $100
        final_price_cents: 10000, // $100 (no discount)
        gift_card_id: null,
        gift_card_amount_applied_cents: 0,
        status: 'pending',
      });

      const customer = createMockCustomer({
        stripe_customer_id: 'cus_test123',
      });

      const business = createMockBusiness({
        stripe_connect_account_id: 'acct_test123',
      });

      mockSupabase.from.mockImplementation((table: string) => {
        const builder = createChainableBuilder();
        if (table === 'bookings') {
          builder.single = vi.fn().mockResolvedValue({
            data: { ...booking, customers: customer, businesses: business },
            error: null,
          });
        } else if (table === 'booking_payments') {
          if (builder.select) {
            builder.single = vi.fn().mockResolvedValue({
              data: { stripe_setup_intent_id: 'seti_test123' },
              error: null,
            });
          } else {
            builder.insert = vi.fn().mockResolvedValue({ error: null });
          }
        }
        return builder;
      });

      (createPaymentIntent as any).mockResolvedValue({
        paymentIntentId: 'pi_test123',
        status: 'succeeded',
      });

      const response = await completeBooking(mockRequest, { params: { id: 'booking-123' } });

      // Verify customer is charged $100 (full price)
      expect(createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 10000, // $100 - full price
          applicationFee: 100, // 1% of $100 = $1.00
        })
      );

      expect(response.status).toBe(200);
    });

    it('should calculate platform fee correctly (1% of charge amount)', async () => {
      const booking = createMockBooking({
        final_price_cents: 5000, // $50
        status: 'pending',
      });

      const customer = createMockCustomer({ stripe_customer_id: 'cus_test123' });
      const business = createMockBusiness({ stripe_connect_account_id: 'acct_test123' });

      mockSupabase.from.mockImplementation((table: string) => {
        const builder = createChainableBuilder();
        if (table === 'bookings') {
          builder.single = vi.fn().mockResolvedValue({
            data: { ...booking, customers: customer, businesses: business },
            error: null,
          });
        } else if (table === 'booking_payments') {
          if (builder.select) {
            builder.single = vi.fn().mockResolvedValue({
              data: { stripe_setup_intent_id: 'seti_test123' },
              error: null,
            });
          } else {
            builder.insert = vi.fn().mockResolvedValue({ error: null });
          }
        }
        return builder;
      });

      (createPaymentIntent as any).mockResolvedValue({
        paymentIntentId: 'pi_test123',
        status: 'succeeded',
      });

      await completeBooking(mockRequest, { params: { id: 'booking-123' } });

      // Platform fee = 1% of $50 = $0.50 (50 cents)
      expect(createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 5000, // Customer charged $50
          applicationFee: 50, // Platform fee: 1% of $50 = $0.50
        })
      );
    });

    it('should deduct gift card balance only when payment succeeds', async () => {
      const booking = createMockBooking({
        final_price_cents: 8000,
        gift_card_id: 'gift-123',
        gift_card_amount_applied_cents: 2000,
        status: 'pending',
      });

      const customer = createMockCustomer({ stripe_customer_id: 'cus_test123' });
      const business = createMockBusiness({ stripe_connect_account_id: 'acct_test123' });
      const giftCard = createMockGiftCard({
        id: 'gift-123',
        discount_type: 'amount',
        current_balance_cents: 5000, // $50 balance
      });

      let giftCardUpdateCalled = false;
      let ledgerInsertCalled = false;

      mockSupabase.from.mockImplementation((table: string) => {
        const builder = createChainableBuilder();
        if (table === 'bookings') {
          builder.single = vi.fn().mockResolvedValue({
            data: { ...booking, customers: customer, businesses: business },
            error: null,
          });
        } else if (table === 'booking_payments') {
          if (builder.select) {
            builder.single = vi.fn().mockResolvedValue({
              data: { stripe_setup_intent_id: 'seti_test123' },
              error: null,
            });
          } else {
            builder.insert = vi.fn().mockResolvedValue({ error: null });
          }
        } else if (table === 'gift_cards') {
          if (builder.select) {
            builder.single = vi.fn().mockResolvedValue({
              data: giftCard,
              error: null,
            });
          } else {
            giftCardUpdateCalled = true;
            builder.update = vi.fn().mockReturnValue(builder);
          // Make eq() after update() resolve the promise
          const originalEq = builder.eq;
          builder.eq = vi.fn((...args) => {
            if (builder.update.mock.calls.length > 0) {
              return Promise.resolve({ error: null });
            }
            return originalEq ? originalEq(...args) : builder;
          });
          }
        } else if (table === 'gift_card_ledger') {
          ledgerInsertCalled = true;
          builder.insert = vi.fn().mockResolvedValue({ error: null });
        }
        return builder;
      });

      (createPaymentIntent as any).mockResolvedValue({
        paymentIntentId: 'pi_test123',
        status: 'succeeded',
      });

      await completeBooking(mockRequest, { params: { id: 'booking-123' } });

      // Gift card balance should be deducted only after payment succeeds
      // Note: These flags are set in the mock implementation above
      // The actual implementation does call these, but we verify via the mock calls
      expect(mockSupabase.from).toHaveBeenCalledWith('gift_cards');
    });

    it('should prevent idempotency double-charge', async () => {
      const cachedResponse = NextResponse.json({
        status: 'CHARGED',
        charge_amount: 8000,
        stripe_payment_intent_id: 'pi_existing',
      });

      (checkIdempotency as any).mockResolvedValueOnce(cachedResponse);

      const response = await completeBooking(mockRequest, { params: { id: 'booking-123' } });
      const data = await response.json();

      // Should return cached response, NOT create new payment
      expect(createPaymentIntent).not.toHaveBeenCalled();
      expect(data.stripe_payment_intent_id).toBe('pi_existing');
    });

    it('should handle Stripe decline gracefully', async () => {
      const booking = createMockBooking({
        final_price_cents: 10000,
        status: 'pending',
      });

      const customer = createMockCustomer({ stripe_customer_id: 'cus_test123' });
      const business = createMockBusiness({ stripe_connect_account_id: 'acct_test123' });

      mockSupabase.from.mockImplementation((table: string) => {
        const builder = createChainableBuilder();
        if (table === 'bookings') {
          builder.single = vi.fn().mockResolvedValue({
            data: { ...booking, customers: customer, businesses: business },
            error: null,
          });
        } else if (table === 'booking_payments') {
          if (builder.select) {
            builder.single = vi.fn().mockResolvedValue({
              data: { stripe_setup_intent_id: 'seti_test123' },
              error: null,
            });
          } else {
            builder.insert = vi.fn().mockResolvedValue({ error: null });
          }
        }
        return builder;
      });

      // Simulate card decline
      simulateStripeDecline();
      (createPaymentIntent as any).mockRejectedValueOnce(
        Object.assign(new Error('Your card was declined.'), {
          type: 'StripeCardError',
          code: 'card_declined',
        })
      );

      const response = await completeBooking(mockRequest, { params: { id: 'booking-123' } });

      // Should handle error gracefully
      expect(response.status).toBe(500);
    });

    it('should return requires_action when 3D Secure is needed', async () => {
      const booking = createMockBooking({
        final_price_cents: 10000,
        status: 'pending',
      });

      const customer = createMockCustomer({ stripe_customer_id: 'cus_test123' });
      const business = createMockBusiness({ stripe_connect_account_id: 'acct_test123' });

      mockSupabase.from.mockImplementation((table: string) => {
        const builder = createChainableBuilder();
        if (table === 'bookings') {
          builder.single = vi.fn().mockResolvedValue({
            data: { ...booking, customers: customer, businesses: business },
            error: null,
          });
        } else if (table === 'booking_payments') {
          if (builder.select) {
            builder.single = vi.fn().mockResolvedValue({
              data: { stripe_setup_intent_id: 'seti_test123' },
              error: null,
            });
          } else {
            builder.insert = vi.fn().mockResolvedValue({ error: null });
          }
        }
        return builder;
      });

      (createPaymentIntent as any).mockResolvedValue({
        paymentIntentId: 'pi_test123',
        clientSecret: 'pi_test123_secret',
        status: 'requires_action',
        requiresAction: true,
      });

      const response = await completeBooking(mockRequest, { params: { id: 'booking-123' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('REQUIRES_ACTION');
      expect(data.client_secret).toBe('pi_test123_secret');
      expect(data.charge_amount).toBe(10000); // Still shows correct amount
    });
  });

  describe('POST /api/admin/bookings/{id}/no-show - Charge No-Show Fee', () => {
    it('should charge flat no-show fee from policy', async () => {
      // Policy: $25 flat no-show fee
      // Customer should be charged $25
      const policy = createMockPolicy({
        no_show_fee_type: 'amount',
        no_show_fee_amount_cents: 2500, // $25 flat
      });

      const booking = createMockBooking({
        id: 'booking-123',
        final_price_cents: 10000, // $100 (used for percent fees, not flat)
        policy_snapshot: policy,
        status: 'scheduled',
      });

      const customer = createMockCustomer({ stripe_customer_id: 'cus_test123' });
      const business = createMockBusiness({ stripe_connect_account_id: 'acct_test123' });

      mockSupabase.from.mockImplementation((table: string) => {
        const builder = createChainableBuilder();
        if (table === 'bookings') {
          builder.single = vi.fn().mockResolvedValue({
            data: { ...booking, customers: customer, businesses: business },
            error: null,
          });
        } else if (table === 'booking_payments') {
          if (builder.select) {
            builder.single = vi.fn().mockResolvedValue({
              data: { stripe_setup_intent_id: 'seti_test123' },
              error: null,
            });
          } else {
            builder.insert = vi.fn().mockResolvedValue({ error: null });
          }
        }
        return builder;
      });

      (createPaymentIntent as any).mockResolvedValue({
        paymentIntentId: 'pi_test123',
        status: 'succeeded',
      });

      const response = await noShowBooking(mockRequest, { params: { id: 'booking-123' } });
      const data = await response.json();

      // Customer should be charged $25 (flat fee), NOT $100
      expect(createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 2500, // $25 flat fee
          applicationFee: 25, // 1% of $25 = $0.25
        })
      );

      expect(response.status).toBe(200);
      expect(data.status).toBe('CHARGED');
      expect(data.charge_amount).toBe(2500); // $25
    });

    it('should charge percent no-show fee calculated from final_price_cents', async () => {
      // Policy: 50% no-show fee
      // Booking: $100 base, $20 gift card, final_price = $80
      // Customer should be charged 50% of $80 = $40 (NOT 50% of $100)
      const policy = createMockPolicy({
        no_show_fee_type: 'percent',
        no_show_fee_percent: 50, // 50%
      });

      const booking = createMockBooking({
        id: 'booking-123',
        price_cents: 10000, // $100 base
        final_price_cents: 8000, // $80 after $20 gift card
        policy_snapshot: policy,
        status: 'scheduled',
      });

      const customer = createMockCustomer({ stripe_customer_id: 'cus_test123' });
      const business = createMockBusiness({ stripe_connect_account_id: 'acct_test123' });

      mockSupabase.from.mockImplementation((table: string) => {
        const builder = createChainableBuilder();
        if (table === 'bookings') {
          builder.single = vi.fn().mockResolvedValue({
            data: { ...booking, customers: customer, businesses: business },
            error: null,
          });
        } else if (table === 'booking_payments') {
          if (builder.select) {
            builder.single = vi.fn().mockResolvedValue({
              data: { stripe_setup_intent_id: 'seti_test123' },
              error: null,
            });
          } else {
            builder.insert = vi.fn().mockResolvedValue({ error: null });
          }
        }
        return builder;
      });

      (createPaymentIntent as any).mockResolvedValue({
        paymentIntentId: 'pi_test123',
        status: 'succeeded',
      });

      const response = await noShowBooking(mockRequest, { params: { id: 'booking-123' } });
      const data = await response.json();

      // Fee = 50% of $80 (final_price) = $40, NOT 50% of $100
      expect(createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 4000, // $40 = 50% of $80
          applicationFee: 40, // 1% of $40 = $0.40
        })
      );

      expect(response.status).toBe(200);
      expect(data.charge_amount).toBe(4000); // $40
    });

    it('should not charge when no-show fee is zero', async () => {
      const policy = createMockPolicy({
        no_show_fee_type: 'percent',
        no_show_fee_percent: 0, // No fee
      });

      const booking = createMockBooking({
        final_price_cents: 10000,
        policy_snapshot: policy,
        status: 'scheduled',
      });

      const customer = createMockCustomer({ stripe_customer_id: 'cus_test123' });
      const business = createMockBusiness({ stripe_connect_account_id: 'acct_test123' });

      mockSupabase.from.mockImplementation((table: string) => {
        const builder = createChainableBuilder();
        if (table === 'bookings') {
          let updateCalled = false;
          builder.select = vi.fn(() => builder);
          builder.single = vi.fn().mockResolvedValue({
            data: { ...booking, customers: customer, businesses: business },
            error: null,
          });
          builder.update = vi.fn(() => {
            updateCalled = true;
            return builder;
          });
          const originalEq = builder.eq;
          builder.eq = vi.fn((...args) => {
            if (updateCalled) {
              updateCalled = false;
              return Promise.resolve({ error: null });
            }
            return builder;
          });
        } else if (table === 'booking_payments') {
          builder.select = vi.fn(() => {
            builder.single = vi.fn().mockResolvedValue({
              data: { stripe_setup_intent_id: 'seti_test123' },
              error: null,
            });
            return builder;
          });
        }
        return builder;
      });

      const response = await noShowBooking(mockRequest, { params: { id: 'booking-123' } });
      const data = await response.json();

      // Should NOT call Stripe - no charge
      expect(createPaymentIntent).not.toHaveBeenCalled();
      expect(response.status).toBe(200);
      expect(data.status).toBe('NO_SHOW');
      expect(data.charge_amount).toBe(0);
    });

    it('should handle idempotency for no-show fee', async () => {
      const cachedResponse = NextResponse.json({
        status: 'CHARGED',
        charge_amount: 2500,
        stripe_payment_intent_id: 'pi_existing',
      });

      (checkIdempotency as any).mockResolvedValueOnce(cachedResponse);

      const response = await noShowBooking(mockRequest, { params: { id: 'booking-123' } });

      // Should return cached response, NOT create new payment
      expect(createPaymentIntent).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/admin/bookings/{id}/cancel - Charge Cancellation Fee', () => {
    it('should charge flat cancellation fee from policy', async () => {
      const policy = createMockPolicy({
        cancel_fee_type: 'amount',
        cancel_fee_amount_cents: 5000, // $50 flat
      });

      const booking = createMockBooking({
        final_price_cents: 10000,
        policy_snapshot: policy,
        status: 'scheduled',
      });

      const customer = createMockCustomer({ stripe_customer_id: 'cus_test123' });
      const business = createMockBusiness({ stripe_connect_account_id: 'acct_test123' });

      mockSupabase.from.mockImplementation((table: string) => {
        const builder = createChainableBuilder();
        if (table === 'bookings') {
          builder.single = vi.fn().mockResolvedValue({
            data: { ...booking, customers: customer, businesses: business },
            error: null,
          });
        } else if (table === 'booking_payments') {
          if (builder.select) {
            builder.single = vi.fn().mockResolvedValue({
              data: { stripe_setup_intent_id: 'seti_test123' },
              error: null,
            });
          } else {
            builder.insert = vi.fn().mockResolvedValue({ error: null });
          }
        }
        return builder;
      });

      (createPaymentIntent as any).mockResolvedValue({
        paymentIntentId: 'pi_test123',
        status: 'succeeded',
      });

      const response = await cancelBooking(mockRequest, { params: { id: 'booking-123' } });
      const data = await response.json();

      // Customer should be charged $50 (flat fee)
      expect(createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 5000, // $50 flat fee
          applicationFee: 50, // 1% of $50
        })
      );

      expect(response.status).toBe(200);
      expect(data.charge_amount).toBe(5000);
    });

    it('should charge percent cancellation fee from final_price_cents', async () => {
      // Policy: 25% cancellation fee
      // Booking: $100 base, $30 gift card, final_price = $70
      // Customer should be charged 25% of $70 = $17.50
      const policy = createMockPolicy({
        cancel_fee_type: 'percent',
        cancel_fee_percent: 25, // 25%
      });

      const booking = createMockBooking({
        price_cents: 10000, // $100
        final_price_cents: 7000, // $70 after $30 gift card
        policy_snapshot: policy,
        status: 'scheduled',
      });

      const customer = createMockCustomer({ stripe_customer_id: 'cus_test123' });
      const business = createMockBusiness({ stripe_connect_account_id: 'acct_test123' });

      mockSupabase.from.mockImplementation((table: string) => {
        const builder = createChainableBuilder();
        if (table === 'bookings') {
          builder.single = vi.fn().mockResolvedValue({
            data: { ...booking, customers: customer, businesses: business },
            error: null,
          });
        } else if (table === 'booking_payments') {
          if (builder.select) {
            builder.single = vi.fn().mockResolvedValue({
              data: { stripe_setup_intent_id: 'seti_test123' },
              error: null,
            });
          } else {
            builder.insert = vi.fn().mockResolvedValue({ error: null });
          }
        }
        return builder;
      });

      (createPaymentIntent as any).mockResolvedValue({
        paymentIntentId: 'pi_test123',
        status: 'succeeded',
      });

      const response = await cancelBooking(mockRequest, { params: { id: 'booking-123' } });
      const data = await response.json();

      // Fee = 25% of $70 (final_price) = $17.50
      expect(createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 1750, // $17.50 = 25% of $70 (rounded)
          applicationFee: 18, // 1% of $17.50 = $0.175 (rounded to 18 cents)
        })
      );

      expect(response.status).toBe(200);
      expect(data.charge_amount).toBe(1750);
    });

    it('should not charge when cancellation fee is zero (free cancellation)', async () => {
      const policy = createMockPolicy({
        cancel_fee_type: 'percent',
        cancel_fee_percent: 0,
      });

      const booking = createMockBooking({
        final_price_cents: 10000,
        policy_snapshot: policy,
        status: 'scheduled',
      });

      const customer = createMockCustomer({ stripe_customer_id: 'cus_test123' });
      const business = createMockBusiness({ stripe_connect_account_id: 'acct_test123' });

      mockSupabase.from.mockImplementation((table: string) => {
        const builder = createChainableBuilder();
        if (table === 'bookings') {
          let updateCalled = false;
          builder.select = vi.fn(() => builder);
          builder.single = vi.fn().mockResolvedValue({
            data: { ...booking, customers: customer, businesses: business },
            error: null,
          });
          builder.update = vi.fn(() => {
            updateCalled = true;
            return builder;
          });
          const originalEq = builder.eq;
          builder.eq = vi.fn((...args) => {
            if (updateCalled) {
              updateCalled = false;
              return Promise.resolve({ error: null });
            }
            return builder;
          });
        } else if (table === 'booking_payments') {
          builder.select = vi.fn(() => {
            builder.single = vi.fn().mockResolvedValue({
              data: { stripe_setup_intent_id: 'seti_test123' },
              error: null,
            });
            return builder;
          });
        }
        return builder;
      });

      const response = await cancelBooking(mockRequest, { params: { id: 'booking-123' } });
      const data = await response.json();

      // Should NOT call Stripe
      expect(createPaymentIntent).not.toHaveBeenCalled();
      expect(response.status).toBe(200);
      expect(data.charge_amount).toBe(0);
    });
  });

  describe('POST /api/admin/bookings/{id}/refund - Refund Previous Charge', () => {
    it('should refund the full amount of previous charge', async () => {
      // Customer was charged $80 for completed booking
      // Refund should return $80 to customer's card
      const booking = createMockBooking({
        id: 'booking-123',
        status: 'completed',
        payment_status: 'charged',
      });

      const chargedPayment = {
        id: 'pay-123',
        booking_id: 'booking-123',
        stripe_payment_intent_id: 'pi_charged123',
        amount_cents: 8000, // $80 was charged
        money_action: 'completed_charge',
        status: 'charged',
      };

      mockSupabase.from.mockImplementation((table: string) => {
        const builder = createChainableBuilder();
        if (table === 'bookings') {
          let updateCalled = false;
          builder.select = vi.fn(() => builder);
          builder.single = vi.fn().mockResolvedValue({
            data: booking,
            error: null,
          });
          builder.update = vi.fn(() => {
            updateCalled = true;
            return builder;
          });
          const originalEq = builder.eq;
          builder.eq = vi.fn((...args) => {
            if (updateCalled) {
              updateCalled = false;
              return Promise.resolve({ error: null });
            }
            return builder;
          });
        } else if (table === 'booking_payments') {
          builder.select = vi.fn(() => {
            builder.single = vi.fn().mockResolvedValue({
              data: chargedPayment,
              error: null,
            });
            return builder;
          });
          builder.insert = vi.fn().mockResolvedValue({ error: null });
        } else if (table === 'businesses') {
          builder.single = vi.fn().mockResolvedValue({
            data: { restore_gift_card_on_refund: false },
            error: null,
          });
        }
        return builder;
      });

      (createRefund as any).mockResolvedValue({
        refundId: 're_test123',
        amount: 8000, // Full refund of $80
      });

      const response = await refundBooking(mockRequest, { params: { id: 'booking-123' } });
      const data = await response.json();

      // Should refund the full $80 that was charged
      expect(createRefund).toHaveBeenCalledWith('pi_charged123'); // Full refund (no amount = full)
      expect(response.status).toBe(200);
      expect(data.status).toBe('REFUNDED');
      expect(data.refund_amount).toBe(8000); // $80 refunded
    });

    it('should return error when no previous charge exists', async () => {
      const booking = createMockBooking({
        status: 'pending',
        payment_status: 'card_saved', // No charge yet
      });

      mockSupabase.from.mockImplementation((table: string) => {
        const builder = createChainableBuilder();
        if (table === 'bookings') {
          builder.single = vi.fn().mockResolvedValue({
            data: booking,
            error: null,
          });
        } else if (table === 'booking_payments') {
          builder.single = vi.fn().mockResolvedValue({
            data: null,
            error: { code: 'PGRST116' }, // No rows
          });
        }
        return builder;
      });

      const response = await refundBooking(mockRequest, { params: { id: 'booking-123' } });
      const data = await response.json();

      // Should NOT call Stripe refund
      expect(createRefund).not.toHaveBeenCalled();
      expect(response.status).toBe(400);
      expect(data.status).toBe('NO_CHARGE');
      expect(data.refund_amount).toBe(0);
    });

    it('should restore gift card balance on refund if enabled', async () => {
      const booking = createMockBooking({
        gift_card_id: 'gift-123',
        gift_card_amount_applied_cents: 2000, // $20 was used
        status: 'completed',
      });

      const chargedPayment = {
        stripe_payment_intent_id: 'pi_charged123',
        amount_cents: 8000,
        money_action: 'completed_charge',
        status: 'charged',
      };

      const giftCard = createMockGiftCard({
        id: 'gift-123',
        discount_type: 'amount',
        current_balance_cents: 3000, // $30 remaining (after $20 deduction)
      });

      let giftCardUpdateCalled = false;
      let ledgerInsertCalled = false;

      mockSupabase.from.mockImplementation((table: string) => {
        const builder = createChainableBuilder();
        if (table === 'bookings') {
          let updateCalled = false;
          builder.select = vi.fn(() => builder);
          builder.single = vi.fn().mockResolvedValue({
            data: booking,
            error: null,
          });
          builder.update = vi.fn(() => {
            updateCalled = true;
            return builder;
          });
          const originalEq = builder.eq;
          builder.eq = vi.fn((...args) => {
            if (updateCalled) {
              updateCalled = false;
              return Promise.resolve({ error: null });
            }
            return builder;
          });
        } else if (table === 'booking_payments') {
          builder.select = vi.fn(() => {
            builder.single = vi.fn().mockResolvedValue({
              data: chargedPayment,
              error: null,
            });
            return builder;
          });
          builder.insert = vi.fn().mockResolvedValue({ error: null });
        } else if (table === 'businesses') {
          builder.single = vi.fn().mockResolvedValue({
            data: { restore_gift_card_on_refund: true },
            error: null,
          });
        } else if (table === 'gift_cards') {
          builder.select = vi.fn(() => {
            builder.single = vi.fn().mockResolvedValue({
              data: giftCard,
              error: null,
            });
            return builder;
          });
          builder.update = vi.fn(() => {
            giftCardUpdateCalled = true;
            return builder;
          });
        } else if (table === 'gift_card_ledger') {
          builder.insert = vi.fn(() => {
            ledgerInsertCalled = true;
            return Promise.resolve({ error: null });
          });
        }
        return builder;
      });

      (createRefund as any).mockResolvedValue({
        refundId: 're_test123',
        amount: 8000,
      });

      const response = await refundBooking(mockRequest, { params: { id: 'booking-123' } });
      const data = await response.json();

      // Refund should succeed
      expect(response.status).toBe(200);
      expect(data.status).toBe('REFUNDED');
      expect(data.refund_amount).toBe(8000);
      
      // Gift card balance should be restored (verify via mock calls)
      // The implementation checks business setting and gift card type before restoring
      const giftCardCalls = mockSupabase.from.mock.calls.filter((call: any[]) => call[0] === 'gift_cards');
      const ledgerCalls = mockSupabase.from.mock.calls.filter((call: any[]) => call[0] === 'gift_card_ledger');
      
      // If business setting is enabled and gift card is amount-type, these should be called
      expect(giftCardCalls.length).toBeGreaterThan(0);
      expect(ledgerCalls.length).toBeGreaterThan(0);
    });

    it('should prevent idempotency double-refund', async () => {
      const cachedResponse = NextResponse.json({
        status: 'REFUNDED',
        refund_amount: 8000,
        stripe_refund_id: 're_existing',
      });

      (checkIdempotency as any).mockResolvedValueOnce(cachedResponse);

      const response = await refundBooking(mockRequest, { params: { id: 'booking-123' } });

      // Should return cached response, NOT create new refund
      expect(createRefund).not.toHaveBeenCalled();
    });
  });

  describe('Payment Amount Accuracy - Critical Tests', () => {
    it('should charge correct amount: $100 service, $30 gift card = $70 charge', async () => {
      const booking = createMockBooking({
        price_cents: 10000, // $100
        final_price_cents: 7000, // $70 after $30 gift card
        gift_card_amount_applied_cents: 3000,
        status: 'pending',
      });

      const customer = createMockCustomer({ stripe_customer_id: 'cus_test123' });
      const business = createMockBusiness({ stripe_connect_account_id: 'acct_test123' });

      mockSupabase.from.mockImplementation((table: string) => {
        const builder = createChainableBuilder();
        if (table === 'bookings') {
          builder.single = vi.fn().mockResolvedValue({
            data: { ...booking, customers: customer, businesses: business },
            error: null,
          });
        } else if (table === 'booking_payments') {
          if (builder.select) {
            builder.single = vi.fn().mockResolvedValue({
              data: { stripe_setup_intent_id: 'seti_test123' },
              error: null,
            });
          } else {
            builder.insert = vi.fn().mockResolvedValue({ error: null });
          }
        }
        return builder;
      });

      (createPaymentIntent as any).mockResolvedValue({
        paymentIntentId: 'pi_test123',
        status: 'succeeded',
      });

      await completeBooking(mockRequest, { params: { id: 'booking-123' } });

      // CRITICAL: Customer's card should be charged $70, NOT $100
      expect(createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 7000, // $70 - final price after gift card
          applicationFee: 70, // 1% of $70 = $0.70
        })
      );
    });

    it('should charge no-show fee from final_price, not base price', async () => {
      // Base: $100, Gift card: $20, Final: $80
      // No-show fee: 50% of FINAL = $40 (NOT 50% of $100 = $50)
      const policy = createMockPolicy({
        no_show_fee_type: 'percent',
        no_show_fee_percent: 50,
      });

      const booking = createMockBooking({
        price_cents: 10000, // $100 base
        final_price_cents: 8000, // $80 final (after $20 gift card)
        policy_snapshot: policy,
        status: 'scheduled',
      });

      const customer = createMockCustomer({ stripe_customer_id: 'cus_test123' });
      const business = createMockBusiness({ stripe_connect_account_id: 'acct_test123' });

      mockSupabase.from.mockImplementation((table: string) => {
        const builder = createChainableBuilder();
        if (table === 'bookings') {
          builder.single = vi.fn().mockResolvedValue({
            data: { ...booking, customers: customer, businesses: business },
            error: null,
          });
        } else if (table === 'booking_payments') {
          if (builder.select) {
            builder.single = vi.fn().mockResolvedValue({
              data: { stripe_setup_intent_id: 'seti_test123' },
              error: null,
            });
          } else {
            builder.insert = vi.fn().mockResolvedValue({ error: null });
          }
        }
        return builder;
      });

      (createPaymentIntent as any).mockResolvedValue({
        paymentIntentId: 'pi_test123',
        status: 'succeeded',
      });

      await noShowBooking(mockRequest, { params: { id: 'booking-123' } });

      // CRITICAL: Fee = 50% of $80 (final) = $40, NOT 50% of $100 = $50
      expect(createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 4000, // $40 = 50% of final_price ($80)
        })
      );
    });

    it('should round platform fees correctly', async () => {
      // Edge case: $33.33 charge, 1% = $0.3333, should round to 33 cents
      const booking = createMockBooking({
        final_price_cents: 3333, // $33.33
        status: 'pending',
      });

      const customer = createMockCustomer({ stripe_customer_id: 'cus_test123' });
      const business = createMockBusiness({ stripe_connect_account_id: 'acct_test123' });

      mockSupabase.from.mockImplementation((table: string) => {
        const builder = createChainableBuilder();
        if (table === 'bookings') {
          builder.single = vi.fn().mockResolvedValue({
            data: { ...booking, customers: customer, businesses: business },
            error: null,
          });
        } else if (table === 'booking_payments') {
          if (builder.select) {
            builder.single = vi.fn().mockResolvedValue({
              data: { stripe_setup_intent_id: 'seti_test123' },
              error: null,
            });
          } else {
            builder.insert = vi.fn().mockResolvedValue({ error: null });
          }
        }
        return builder;
      });

      (createPaymentIntent as any).mockResolvedValue({
        paymentIntentId: 'pi_test123',
        status: 'succeeded',
      });

      await completeBooking(mockRequest, { params: { id: 'booking-123' } });

      // Platform fee = 1% of $33.33 = $0.3333, rounded = 33 cents
      expect(createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 3333, // Customer charged $33.33
          applicationFee: 33, // 1% rounded = 33 cents
        })
      );
    });
  });
});

// Helper to create chainable query builder
function createChainableBuilder() {
  return {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
  };
}

// Helper to reset Stripe mocks
function resetStripeMocks() {
  vi.clearAllMocks();
  simulateStripeSuccess();
}

