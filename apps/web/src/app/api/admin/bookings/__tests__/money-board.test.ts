/**
 * Comprehensive test suite for Admin Past Bookings (Money Board) API
 * 
 * Tests cover:
 * - GET /api/admin/bookings (list bookings)
 * - POST /api/admin/bookings/{id}/complete
 * - POST /api/admin/bookings/{id}/no-show
 * - POST /api/admin/bookings/{id}/cancel
 * - POST /api/admin/bookings/{id}/refund
 * 
 * All tests verify:
 * - Authentication and authorization
 * - Idempotency handling
 * - Stripe integration
 * - Database updates
 * - Error handling
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';
import { POST as POSTComplete } from '../[id]/complete/route';
import { POST as POSTNoShow } from '../[id]/no-show/route';
import { POST as POSTCancel } from '../[id]/cancel/route';
import { POST as POSTRefund } from '../[id]/refund/route';
import * as stripeLib from '@/lib/stripe';
import * as idempotencyLib from '@/lib/idempotency';
import * as authLib from '@/lib/auth';
import { createServerClient } from '@/lib/db';

// Mock dependencies
vi.mock('@/lib/db');
vi.mock('@/lib/auth');
vi.mock('@/lib/stripe');
vi.mock('@/lib/idempotency');

describe('Admin Past Bookings API', () => {
  const mockUserId = 'user-123';
  const mockBusinessId = 'business-123';
  const mockBookingId = 'booking-123';
  const mockIdempotencyKey = 'idempotency-key-123';

  // Create a chainable query builder mock
  // Supabase queries work like: from('table').select(...).eq(...).single()
  // Or: from('table').insert(...) or from('table').update(...).eq(...)
  // The key: The query builder itself is awaitable (thenable), and methods can be chained
  const createQueryBuilder = () => {
    // Track the final promise that will be returned when awaited
    let finalPromise: Promise<any> | null = null;
    let isUpdateQuery = false;
    
    const builder: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn(function(...args: any[]) {
        // If this is after update(), set the final promise and return it
        if (isUpdateQuery) {
          finalPromise = finalPromise || Promise.resolve({ error: null });
          isUpdateQuery = false;
          return finalPromise;
        }
        return this; // Return this for chaining
      }),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      single: function() {
        // single() returns a promise directly
        // Use finalPromise if set, otherwise return default
        const promise = finalPromise || Promise.resolve({ data: null, error: null });
        // Make the result awaitable by returning the promise
        return promise;
      },
      insert: vi.fn(function() {
        // insert() returns a promise directly
        return finalPromise || Promise.resolve({ error: null });
      }),
      update: vi.fn(function() {
        isUpdateQuery = true;
        return this; // Return this for chaining with .eq()
      }).mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      // Make the builder itself awaitable (thenable)
      // This is used when the route does: await supabase.from(...).select(...).eq(...)
      then: function(onFulfilled: any, onRejected: any) {
        const promise = finalPromise || Promise.resolve({ data: null, error: null });
        return promise.then(onFulfilled, onRejected);
      },
      catch: function(onRejected: any) {
        const promise = finalPromise || Promise.resolve({ data: null, error: null });
        return promise.catch(onRejected);
      },
      // Helper to set the final promise for limit() queries
      setFinalPromise: function(promise: Promise<any>) {
        finalPromise = promise;
      },
      // Helper to set the promise that eq() should return after update()
      setEqPromise: function(promise: Promise<any>) {
        finalPromise = promise;
      },
    };
    return builder;
  };

  const mockSupabase = {
    from: vi.fn(() => createQueryBuilder()),
    auth: {
      getUser: vi.fn(),
    },
  };

  // Helper to set up table-specific query builders
  const setupTableMocks = (tableConfigs: Record<string, { data?: any; error?: any }>) => {
    mockSupabase.from.mockImplementation((tableName: string) => {
      const builder = createQueryBuilder();
      const config = tableConfigs[tableName];
      if (config) {
        if (config.error) {
          builder.setFinalPromise(Promise.resolve({ data: null, error: config.error }));
        } else {
          builder.setFinalPromise(Promise.resolve({ data: config.data, error: null }));
        }
      }
      return builder;
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default auth mocks
    (authLib.getCurrentUserId as Mock).mockResolvedValue(mockUserId);
    (authLib.getCurrentBusinessId as Mock).mockResolvedValue(mockBusinessId);
    
    // Reset the from mock to return a new query builder each time by default
    mockSupabase.from.mockImplementation(() => createQueryBuilder());
    
    // Default Supabase mock
    (createServerClient as Mock).mockResolvedValue(mockSupabase);
    
    // Default idempotency mock (no cached response)
    (idempotencyLib.checkIdempotency as Mock).mockResolvedValue(null);
    (idempotencyLib.storeIdempotency as Mock).mockResolvedValue(undefined);
  });

  describe('GET /api/admin/bookings', () => {
    it('should return bookings list with pagination', async () => {
      const mockBookings = [
        {
          id: mockBookingId,
          status: 'pending',
          start_at: '2025-01-20T10:00:00Z',
          end_at: '2025-01-20T11:00:00Z',
          duration_min: 60,
          price_cents: 10000,
          final_price_cents: 10000,
          gift_card_amount_applied_cents: 0,
          payment_status: 'card_saved',
          last_money_action: 'none',
          source: 'public',
          created_at: '2025-01-15T10:00:00Z',
          customers: {
            id: 'customer-123',
            name: 'John Doe',
            email: 'john@example.com',
            phone: '+1234567890',
          },
          services: {
            id: 'service-123',
            name: 'Haircut',
            duration_min: 60,
            price_cents: 10000,
          },
          staff: {
            id: 'staff-123',
            name: 'Jane Smith',
          },
        },
      ];

      // Setup the query chain mocks
      // Main query for bookings list
      const mainQueryBuilder = createQueryBuilder();
      mainQueryBuilder.setFinalPromise(Promise.resolve({ data: mockBookings, error: null }));
      mockSupabase.from.mockReturnValueOnce(mainQueryBuilder);
      
      // Cursor query (for pagination check - returns null in this test)
      const cursorQueryBuilder = createQueryBuilder();
      cursorQueryBuilder.setFinalPromise(Promise.resolve({ data: null, error: null }));
      mockSupabase.from.mockReturnValueOnce(cursorQueryBuilder);

      const request = new NextRequest('http://localhost/api/admin/bookings');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.items).toHaveLength(1);
      expect(data.items[0]).toMatchObject({
        id: mockBookingId,
        code: expect.stringMatching(/^REVOL-/),
        status: 'pending',
        service: {
          name: 'Haircut',
          duration_min: 60,
          price_cents: 10000,
        },
        staff: {
          name: 'Jane Smith',
        },
        customer: {
          name: 'John Doe',
          email: 'john@example.com',
          phone: '+1234567890',
        },
        final_price_cents: 10000,
        gift_discount_cents: 0,
        last_payment_status: 'card_saved',
      });
    });

    it('should filter by status', async () => {
      // Track all builders created
      const allBuilders: Array<{ tableName: string; builder: any }> = [];
      let bookingsCallCount = 0;
      
      // Reset and set up mock implementation
      mockSupabase.from.mockReset();
      mockSupabase.from.mockImplementation((tableName: string) => {
        const builder = createQueryBuilder();
        allBuilders.push({ tableName, builder });
        
        if (tableName === 'bookings') {
          bookingsCallCount++;
          if (bookingsCallCount === 1) {
            // Main query returns empty array
            builder.setFinalPromise(Promise.resolve({ data: [], error: null }));
          } else {
            // Cursor query (returns null if cursor not found)
            builder.setFinalPromise(Promise.resolve({ data: null, error: null }));
          }
        } else {
          // Default for other tables
          builder.setFinalPromise(Promise.resolve({ data: null, error: null }));
        }
        
        return builder;
      });

      const request = new NextRequest('http://localhost/api/admin/bookings?status=completed');
      await GET(request);

      // Check that from was called with 'bookings'
      expect(mockSupabase.from).toHaveBeenCalledWith('bookings');
      // Find the first bookings builder
      const bookingsBuilder = allBuilders.find(b => b.tableName === 'bookings');
      expect(bookingsBuilder).toBeDefined();
      expect(bookingsBuilder!.builder.eq).toHaveBeenCalled();
      const eqCalls = (bookingsBuilder!.builder.eq as any).mock.calls;
      const statusCall = eqCalls.find((call: any[]) => call[0] === 'status' && call[1] === 'completed');
      expect(statusCall).toBeDefined();
    });

    it('should filter by date range', async () => {
      // Track all query builders created for bookings table
      const bookingsBuilders: any[] = [];
      
      mockSupabase.from.mockImplementation((tableName: string) => {
        const builder = createQueryBuilder();
        
        if (tableName === 'bookings') {
          bookingsBuilders.push(builder);
          // Main query returns empty array
          builder.setFinalPromise(Promise.resolve({ data: [], error: null }));
        } else {
          // Cursor query (not used in this test)
          builder.setFinalPromise(Promise.resolve({ data: null, error: null }));
        }
        
        return builder;
      });

      const request = new NextRequest('http://localhost/api/admin/bookings?from=2025-01-01&to=2025-01-31');
      await GET(request);

      // Check that gte and lte were called on the main query builder
      expect(bookingsBuilders.length).toBeGreaterThan(0);
      const mainBuilder = bookingsBuilders[0];
      expect(mainBuilder.gte).toHaveBeenCalled();
      expect(mainBuilder.lte).toHaveBeenCalled();
    });

    it('should return 401 if not authenticated', async () => {
      (authLib.getCurrentUserId as Mock).mockResolvedValueOnce(null);

      const request = new NextRequest('http://localhost/api/admin/bookings');
      const response = await GET(request);

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/admin/bookings/{id}/complete', () => {
    const mockBooking = {
      id: mockBookingId,
      status: 'pending',
      final_price_cents: 10000,
      gift_card_id: null,
      gift_card_amount_applied_cents: 0,
      customers: {
        stripe_customer_id: 'cus_123',
      },
      businesses: {
        stripe_connect_account_id: 'acct_123',
      },
    };

    it('should charge full amount and mark booking as completed', async () => {
      // Set up table-specific mocks
      // Track call order for bookings table (first call: select, second call: update)
      let bookingsCallCount = 0;
      let bookingPaymentsCallCount = 0;
      
      mockSupabase.from.mockImplementation((tableName: string) => {
        const builder = createQueryBuilder();
        
        if (tableName === 'bookings') {
          bookingsCallCount++;
          if (bookingsCallCount === 1) {
            // First call: select booking
            builder.setFinalPromise(Promise.resolve({ data: mockBooking, error: null }));
          } else {
            // Subsequent calls: update booking
            builder.setEqPromise(Promise.resolve({ error: null }));
          }
        } else if (tableName === 'booking_payments') {
          bookingPaymentsCallCount++;
          if (bookingPaymentsCallCount === 1) {
            // First call: select setup payment
            builder.setFinalPromise(Promise.resolve({ data: { stripe_setup_intent_id: 'seti_123' }, error: null }));
          } else {
            // Subsequent calls: insert payment record
            builder.setFinalPromise(Promise.resolve({ error: null }));
          }
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

      const request = new NextRequest('http://localhost/api/admin/bookings/123/complete', {
        method: 'POST',
        headers: {
          'X-Idempotency-Key': mockIdempotencyKey,
        },
      });

      const response = await POSTComplete(request, { params: { id: mockBookingId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('CHARGED');
      expect(data.charge_amount).toBe(10000);
      expect(stripeLib.createPaymentIntent).toHaveBeenCalledWith({
        amount: 10000,
        customerId: 'cus_123',
        paymentMethodId: 'pm_123',
        connectAccountId: 'acct_123',
        applicationFee: 100, // 1% of 10000
        offSession: true,
        metadata: expect.objectContaining({
          booking_id: mockBookingId,
          business_id: mockBusinessId,
          money_action: 'completed_charge',
        }),
      });
    });

    it('should require idempotency key', async () => {
      const request = new NextRequest('http://localhost/api/admin/bookings/123/complete', {
        method: 'POST',
      });

      const response = await POSTComplete(request, { params: { id: mockBookingId } });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('X-Idempotency-Key');
    });

    it('should return cached response for duplicate idempotency key', async () => {
      const cachedResponse = { status: 'CHARGED', charge_amount: 10000 };
      (idempotencyLib.checkIdempotency as Mock).mockResolvedValueOnce(
        new Response(JSON.stringify(cachedResponse))
      );

      const request = new NextRequest('http://localhost/api/admin/bookings/123/complete', {
        method: 'POST',
        headers: {
          'X-Idempotency-Key': mockIdempotencyKey,
        },
      });

      const response = await POSTComplete(request, { params: { id: mockBookingId } });
      const data = await response.json();

      expect(data).toEqual(cachedResponse);
      expect(stripeLib.createPaymentIntent).not.toHaveBeenCalled();
    });

    it('should handle payment requires action', async () => {
      // Set up table-specific mocks
      let bookingsCallCount = 0;
      let bookingPaymentsCallCount = 0;
      
      mockSupabase.from.mockImplementation((tableName: string) => {
        const builder = createQueryBuilder();
        
        if (tableName === 'bookings') {
          bookingsCallCount++;
          if (bookingsCallCount === 1) {
            builder.setFinalPromise(Promise.resolve({ data: mockBooking, error: null }));
          } else {
            builder.setEqPromise(Promise.resolve({ error: null }));
          }
        } else if (tableName === 'booking_payments') {
          bookingPaymentsCallCount++;
          if (bookingPaymentsCallCount === 1) {
            builder.setFinalPromise(Promise.resolve({ data: { stripe_setup_intent_id: 'seti_123' }, error: null }));
          } else {
            builder.setFinalPromise(Promise.resolve({ error: null }));
          }
        }
        
        return builder;
      });

      (stripeLib.getPaymentMethodFromSetupIntent as Mock).mockResolvedValue('pm_123');
      (stripeLib.createPaymentIntent as Mock).mockResolvedValue({
        paymentIntentId: 'pi_123',
        clientSecret: 'pi_123_secret',
        status: 'requires_action',
        requiresAction: true,
      });

      const request = new NextRequest('http://localhost/api/admin/bookings/123/complete', {
        method: 'POST',
        headers: {
          'X-Idempotency-Key': mockIdempotencyKey,
        },
      });

      const response = await POSTComplete(request, { params: { id: mockBookingId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('REQUIRES_ACTION');
      expect(data.client_secret).toBe('pi_123_secret');
    });

    it('should handle payment failure', async () => {
      // Set up table-specific mocks
      let bookingsCallCount = 0;
      let bookingPaymentsCallCount = 0;
      
      mockSupabase.from.mockImplementation((tableName: string) => {
        const builder = createQueryBuilder();
        
        if (tableName === 'bookings') {
          bookingsCallCount++;
          if (bookingsCallCount === 1) {
            builder.setFinalPromise(Promise.resolve({ data: mockBooking, error: null }));
          } else {
            builder.setEqPromise(Promise.resolve({ error: null }));
          }
        } else if (tableName === 'booking_payments') {
          bookingPaymentsCallCount++;
          if (bookingPaymentsCallCount === 1) {
            builder.setFinalPromise(Promise.resolve({ data: { stripe_setup_intent_id: 'seti_123' }, error: null }));
          } else {
            builder.setFinalPromise(Promise.resolve({ error: null }));
          }
        }
        
        return builder;
      });

      (stripeLib.getPaymentMethodFromSetupIntent as Mock).mockResolvedValue('pm_123');
      (stripeLib.createPaymentIntent as Mock).mockResolvedValue({
        paymentIntentId: 'pi_123',
        clientSecret: 'pi_123_secret',
        status: 'payment_failed',
        requiresAction: false,
      });

      const request = new NextRequest('http://localhost/api/admin/bookings/123/complete', {
        method: 'POST',
        headers: {
          'X-Idempotency-Key': mockIdempotencyKey,
        },
      });

      const response = await POSTComplete(request, { params: { id: mockBookingId } });
      const data = await response.json();

      expect(response.status).toBe(402);
      expect(data.error).toBe('Payment failed');
    });
  });

  describe('POST /api/admin/bookings/{id}/no-show', () => {
    const mockBooking = {
      id: mockBookingId,
      status: 'pending',
      final_price_cents: 10000,
      policy_snapshot: {
        no_show_fee_type: 'percent',
        no_show_fee_percent: 50,
      },
      customers: {
        stripe_customer_id: 'cus_123',
      },
      businesses: {
        stripe_connect_account_id: 'acct_123',
      },
    };

    it('should charge no-show fee from policy', async () => {
      // Set up table-specific mocks
      let bookingsCallCount = 0;
      let bookingPaymentsCallCount = 0;
      
      mockSupabase.from.mockImplementation((tableName: string) => {
        const builder = createQueryBuilder();
        
        if (tableName === 'bookings') {
          bookingsCallCount++;
          if (bookingsCallCount === 1) {
            builder.setFinalPromise(Promise.resolve({ data: mockBooking, error: null }));
          } else {
            builder.setEqPromise(Promise.resolve({ error: null }));
          }
        } else if (tableName === 'booking_payments') {
          bookingPaymentsCallCount++;
          if (bookingPaymentsCallCount === 1) {
            builder.setFinalPromise(Promise.resolve({ data: { stripe_setup_intent_id: 'seti_123' }, error: null }));
          } else {
            builder.setFinalPromise(Promise.resolve({ error: null }));
          }
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

      const request = new NextRequest('http://localhost/api/admin/bookings/123/no-show', {
        method: 'POST',
        headers: {
          'X-Idempotency-Key': mockIdempotencyKey,
        },
      });

      const response = await POSTNoShow(request, { params: { id: mockBookingId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('CHARGED');
      // 50% of 10000 = 5000 cents
      expect(data.charge_amount).toBe(5000);
    });

    it('should handle zero no-show fee', async () => {
      const bookingWithZeroFee = {
        ...mockBooking,
        policy_snapshot: {
          no_show_fee_type: 'amount',
          no_show_fee_amount_cents: 0,
        },
      };

      // Set up table-specific mocks
      let bookingsCallCount = 0;
      let bookingPaymentsCallCount = 0;
      
      mockSupabase.from.mockImplementation((tableName: string) => {
        const builder = createQueryBuilder();
        
        if (tableName === 'bookings') {
          bookingsCallCount++;
          if (bookingsCallCount === 1) {
            builder.setFinalPromise(Promise.resolve({ data: bookingWithZeroFee, error: null }));
          } else {
            builder.setEqPromise(Promise.resolve({ error: null }));
          }
        } else if (tableName === 'booking_payments') {
          bookingPaymentsCallCount++;
          // Route checks for payment method even if fee is 0
          builder.setFinalPromise(Promise.resolve({ data: { stripe_setup_intent_id: 'seti_123' }, error: null }));
        }
        
        return builder;
      });

      const request = new NextRequest('http://localhost/api/admin/bookings/123/no-show', {
        method: 'POST',
        headers: {
          'X-Idempotency-Key': mockIdempotencyKey,
        },
      });

      const response = await POSTNoShow(request, { params: { id: mockBookingId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('NO_SHOW');
      expect(data.charge_amount).toBe(0);
      expect(stripeLib.createPaymentIntent).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/admin/bookings/{id}/cancel', () => {
    const mockBooking = {
      id: mockBookingId,
      status: 'pending',
      final_price_cents: 10000,
      policy_snapshot: {
        cancel_fee_type: 'amount',
        cancel_fee_amount_cents: 2000,
      },
      customers: {
        stripe_customer_id: 'cus_123',
      },
      businesses: {
        stripe_connect_account_id: 'acct_123',
      },
    };

    it('should charge cancellation fee from policy', async () => {
      // Set up table-specific mocks
      let bookingsCallCount = 0;
      let bookingPaymentsCallCount = 0;
      
      mockSupabase.from.mockImplementation((tableName: string) => {
        const builder = createQueryBuilder();
        
        if (tableName === 'bookings') {
          bookingsCallCount++;
          if (bookingsCallCount === 1) {
            builder.setFinalPromise(Promise.resolve({ data: mockBooking, error: null }));
          } else {
            builder.setEqPromise(Promise.resolve({ error: null }));
          }
        } else if (tableName === 'booking_payments') {
          bookingPaymentsCallCount++;
          if (bookingPaymentsCallCount === 1) {
            builder.setFinalPromise(Promise.resolve({ data: { stripe_setup_intent_id: 'seti_123' }, error: null }));
          } else {
            builder.setFinalPromise(Promise.resolve({ error: null }));
          }
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

      const request = new NextRequest('http://localhost/api/admin/bookings/123/cancel', {
        method: 'POST',
        headers: {
          'X-Idempotency-Key': mockIdempotencyKey,
        },
      });

      const response = await POSTCancel(request, { params: { id: mockBookingId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('CHARGED');
      expect(data.charge_amount).toBe(2000);
    });
  });

  describe('POST /api/admin/bookings/{id}/refund', () => {
    const mockBooking = {
      id: mockBookingId,
      status: 'completed',
      gift_card_id: null,
      gift_card_amount_applied_cents: 0,
      policy_snapshot: {},
    };

    it('should refund previous charge', async () => {
      // Set up table-specific mocks
      let bookingsCallCount = 0;
      let bookingPaymentsCallCount = 0;
      
      mockSupabase.from.mockImplementation((tableName: string) => {
        const builder = createQueryBuilder();
        
        if (tableName === 'bookings') {
          bookingsCallCount++;
          if (bookingsCallCount === 1) {
            builder.setFinalPromise(Promise.resolve({ data: mockBooking, error: null }));
          } else {
            builder.setEqPromise(Promise.resolve({ error: null }));
          }
        } else if (tableName === 'booking_payments') {
          bookingPaymentsCallCount++;
          if (bookingPaymentsCallCount === 1) {
            // First call: get charged payment
            builder.setFinalPromise(Promise.resolve({
              data: {
                stripe_payment_intent_id: 'pi_123',
                amount_cents: 10000,
                status: 'charged',
              },
              error: null,
            }));
          } else {
            // Subsequent calls: insert refund record
            builder.setFinalPromise(Promise.resolve({ error: null }));
          }
        }
        
        return builder;
      });
      
      // Note: Gift card updates would go here if the booking had a gift card

      (stripeLib.createRefund as Mock).mockResolvedValue({
        refundId: 're_123',
        amount: 10000,
      });

      const request = new NextRequest('http://localhost/api/admin/bookings/123/refund', {
        method: 'POST',
        headers: {
          'X-Idempotency-Key': mockIdempotencyKey,
        },
      });

      const response = await POSTRefund(request, { params: { id: mockBookingId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('REFUNDED');
      expect(data.refund_amount).toBe(10000);
      expect(stripeLib.createRefund).toHaveBeenCalledWith('pi_123');
    });

    it('should return NO_CHARGE if no previous charge exists', async () => {
      // Set up table-specific mocks
      let bookingsCallCount = 0;
      let bookingPaymentsCallCount = 0;
      
      mockSupabase.from.mockImplementation((tableName: string) => {
        const builder = createQueryBuilder();
        
        if (tableName === 'bookings') {
          bookingsCallCount++;
          builder.setFinalPromise(Promise.resolve({ data: mockBooking, error: null }));
        } else if (tableName === 'booking_payments') {
          bookingPaymentsCallCount++;
          // Payment not found
          builder.setFinalPromise(Promise.resolve({ data: null, error: { code: 'PGRST116' } }));
        }
        
        return builder;
      });

      const request = new NextRequest('http://localhost/api/admin/bookings/123/refund', {
        method: 'POST',
        headers: {
          'X-Idempotency-Key': mockIdempotencyKey,
        },
      });

      const response = await POSTRefund(request, { params: { id: mockBookingId } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.status).toBe('NO_CHARGE');
      expect(data.message).toContain('No previous charge');
      expect(stripeLib.createRefund).not.toHaveBeenCalled();
    });
  });
});

