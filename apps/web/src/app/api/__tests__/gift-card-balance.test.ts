/**
 * Unit tests for gift card remaining balance behavior
 * Tests that gift cards correctly track and apply remaining balance across multiple bookings
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '../public/[slug]/bookings/route';
import { createAdminClient } from '@/lib/db';
import { createOrGetCustomer, createSetupIntent } from '@/lib/stripe';
import { emitNotification } from '@/lib/notifications';
import { createMockBooking, createMockBusiness, createMockService, createMockGiftCard } from '@/test/factories';

// Mock all dependencies
vi.mock('@/lib/db');
vi.mock('@/lib/stripe');
vi.mock('@/lib/notifications');

describe('Gift Card Remaining Balance Behavior', () => {
  let mockSupabase: any;
  let mockRequest: Request;

  // Helper to create chainable query builder
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
    Object.keys(builder).forEach(key => {
      if (typeof builder[key] === 'function' && key !== 'single' && key !== 'maybeSingle') {
        builder[key].mockReturnValue(builder);
      }
    });
    return builder;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabase = {
      from: vi.fn(() => createChainableBuilder()),
    };

    (createAdminClient as any).mockReturnValue(mockSupabase);
    (createOrGetCustomer as any).mockResolvedValue('cus_test123');
    (createSetupIntent as any).mockResolvedValue({
      setupIntentId: 'seti_test123',
      clientSecret: 'seti_test123_secret',
    });
    (emitNotification as any).mockResolvedValue(undefined);

    // Mock Request
    mockRequest = {
      headers: {
        get: vi.fn((key: string) => {
          if (key === 'x-forwarded-for') return '127.0.0.1';
          if (key === 'user-agent') return 'test-agent';
          return null;
        }),
      },
      json: vi.fn(),
    } as any;
  });

  describe('Remaining Balance Tracking', () => {
    it('should apply only remaining balance on second booking', async () => {
      // Scenario: Card with $100 balance
      // First booking uses $80 -> remaining $20
      // Second booking should only apply $20, not $80

      const giftCard = createMockGiftCard({
        id: 'gift-123',
        code: 'TESTCODE',
        discount_type: 'amount',
        amount_cents: 10000, // $100 initial
        current_balance_cents: 10000, // $100 balance
      });

      const business = createMockBusiness({
        id: 'biz-123',
        subdomain: 'testsalon',
        user_id: 'user-123',
      });

      // First service - $80 price (so first booking uses $80 of $100 balance)
      const firstService = createMockService({
        id: 'svc-123',
        business_id: 'biz-123',
        price_cents: 8000, // $80 service - first booking will use full $80
      });

      // Second service - $100 price (second booking should only use remaining $20)
      const secondService = createMockService({
        id: 'svc-123',
        business_id: 'biz-123',
        price_cents: 10000, // $100 service - but only $20 available
      });

      // First booking - uses $80
      const firstBooking = createMockBooking({
        id: 'booking-1',
        gift_card_id: 'gift-123',
        gift_card_amount_applied_cents: 8000, // $80 used
        final_price_cents: 0, // $0 remaining (service was $80, used $80)
      });

      let bookingCallCount = 0;
      let existingBookingsForGiftCard: any[] = [];

      mockSupabase.from.mockImplementation((table: string) => {
        const builder = createChainableBuilder();
        
        if (table === 'businesses') {
          builder.single = vi.fn().mockResolvedValue({
            data: business,
            error: null,
          });
        } else if (table === 'services') {
          // Return first service for first booking, second service for second booking
          builder.single = vi.fn().mockResolvedValue({
            data: bookingCallCount === 0 ? firstService : secondService,
            error: null,
          });
        } else if (table === 'bookings') {
          let isGiftCardQuery = false;
          let queryDepth = 0;
          
          builder.select = vi.fn((...args) => {
            queryDepth++;
            return builder;
          });
          
          builder.eq = vi.fn((...args) => {
            queryDepth++;
            if (args[0] === 'gift_card_id') {
              isGiftCardQuery = true;
            }
            return builder;
          });
          
          builder.in = vi.fn(() => {
            queryDepth++;
            return builder;
          });
          
          builder.is = vi.fn(() => {
            queryDepth++;
            // After .is() is called on gift card query, return the data
            if (isGiftCardQuery) {
              return Promise.resolve({
                data: existingBookingsForGiftCard,
                error: null,
              });
            }
            return builder;
          });
          
          // For overlap check (select with staff_id, then single)
          builder.single = vi.fn(() => {
            if (!isGiftCardQuery) {
              // This is the overlap check
              return Promise.resolve({
                data: [],
                error: null,
              });
            }
            return builder;
          });
          
          // Insert new booking
          builder.insert = vi.fn(() => {
            bookingCallCount++;
            const newBooking = {
              id: `booking-${bookingCallCount}`,
              gift_card_id: 'gift-123',
              gift_card_amount_applied_cents: bookingCallCount === 1 ? 8000 : 2000,
              final_price_cents: bookingCallCount === 1 ? 2000 : 8000,
              status: 'pending',
            };
            // Add to existing bookings for next query (only after first booking is created)
            // This simulates that the first booking has already used $80
            if (bookingCallCount === 1) {
              existingBookingsForGiftCard.push({
                gift_card_amount_applied_cents: 8000, // $80 already applied
                status: 'pending',
              });
            }
            // insert() must return builder for chaining with .select()
            builder.select = vi.fn(() => {
              builder.single = vi.fn().mockResolvedValue({
                data: { id: newBooking.id },
                error: null,
              });
              return builder;
            });
            // Reset for next call
            isGiftCardQuery = false;
            queryDepth = 0;
            return builder; // Return builder for chaining
          });
          
          // Reset after each from() call
          isGiftCardQuery = false;
          queryDepth = 0;
        } else if (table === 'gift_cards') {
          // Gift card lookup - always returns $100 balance
          // The remaining balance is calculated by subtracting pending bookings
          builder.single = vi.fn().mockResolvedValue({
            data: giftCard,
            error: null,
          });
        } else if (table === 'business_policies') {
          builder.single = vi.fn().mockResolvedValue({
            data: {
              id: 'policy-1',
              cancellation_policy_text: 'Test',
              no_show_policy_text: 'Test',
              refund_policy_text: 'Test',
              cash_policy_text: 'Test',
              no_show_fee_type: 'percent',
              no_show_fee_percent: 50,
              cancel_fee_type: 'percent',
              cancel_fee_percent: 25,
              version: 1,
            },
            error: null,
          });
        } else if (table === 'customers') {
          // Check if this is a select query (looking for existing customer)
          const originalSelect = builder.select;
          builder.select = vi.fn((...args) => {
            // This is a select query - check for existing customer
            builder.single = vi.fn().mockResolvedValue({
              data: null, // New customer (not found)
              error: { code: 'PGRST116' },
            });
            return builder;
          });
          
          // Insert new customer
          builder.insert = vi.fn(() => {
            // insert() must return builder for chaining with .select()
            builder.select = vi.fn(() => {
              builder.single = vi.fn().mockResolvedValue({
                data: { id: 'cust-123' },
                error: null,
              });
              return builder;
            });
            return builder; // Return builder for chaining
          });
          
          // For update after insert
          builder.update = vi.fn(() => {
            return Promise.resolve({ error: null });
          });
        } else if (table === 'booking_payments') {
          builder.insert = vi.fn().mockResolvedValue({ error: null });
        }
        return builder;
      });

      // First booking request
      (mockRequest.json as any).mockResolvedValueOnce({
        service_id: 'svc-123',
        staff_id: 'staff-123',
        start_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        customer: { name: 'John Doe', email: 'john@example.com' },
        gift_card_code: 'TESTCODE',
      });

      const firstResponse = await POST(mockRequest, { params: { slug: 'testsalon' } });
      const firstData = await firstResponse.json();

      // First booking should use $80, final price = $0 (service was $80, used full $80)
      expect(firstResponse.status).toBe(200);
      expect(firstData.final_price_cents).toBe(0); // $0 remaining (service $80, used $80)
      expect(firstData.booking_id).toBe('booking-1');

      // Second booking request - should only use remaining $20
      (mockRequest.json as any).mockResolvedValueOnce({
        service_id: 'svc-123',
        staff_id: 'staff-123',
        start_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        customer: { name: 'Jane Doe', email: 'jane@example.com' },
        gift_card_code: 'TESTCODE',
      });

      const secondResponse = await POST(mockRequest, { params: { slug: 'testsalon' } });
      const secondData = await secondResponse.json();

      // CRITICAL: Second booking should only apply $20 (remaining balance)
      // NOT $80 (original balance)
      expect(secondData.final_price_cents).toBe(8000); // $100 - $20 = $80
      // The gift_card_amount_applied_cents should be $20, not $80
      // This test will FAIL until we fix the implementation
    });

    it('should reject booking when gift card has zero balance', async () => {
      const giftCard = createMockGiftCard({
        code: 'EMPTYCODE',
        discount_type: 'amount',
        current_balance_cents: 0, // $0 balance
      });

      const business = createMockBusiness({ subdomain: 'testsalon' });
      const service = createMockService({ price_cents: 10000 });

      mockSupabase.from.mockImplementation((table: string) => {
        const builder = createChainableBuilder();
        if (table === 'businesses') {
          builder.single = vi.fn().mockResolvedValue({ data: business, error: null });
        } else if (table === 'services') {
          builder.single = vi.fn().mockResolvedValue({ data: service, error: null });
        } else if (table === 'bookings') {
          builder.single = vi.fn().mockResolvedValue({ data: [], error: null });
        } else if (table === 'gift_cards') {
          builder.single = vi.fn().mockResolvedValue({ data: giftCard, error: null });
        }
        return builder;
      });

      (mockRequest.json as any).mockResolvedValue({
        service_id: 'svc-123',
        staff_id: 'staff-123',
        start_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        customer: { name: 'John Doe', email: 'john@example.com' },
        gift_card_code: 'EMPTYCODE',
      });

      const response = await POST(mockRequest, { params: { slug: 'testsalon' } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('no remaining balance');
    });

    it('should reject expired gift card', async () => {
      const expiredGiftCard = createMockGiftCard({
        code: 'EXPIRED',
        expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Expired yesterday
      });

      const business = createMockBusiness({ subdomain: 'testsalon' });
      const service = createMockService();

      mockSupabase.from.mockImplementation((table: string) => {
        const builder = createChainableBuilder();
        if (table === 'businesses') {
          builder.single = vi.fn().mockResolvedValue({ data: business, error: null });
        } else if (table === 'services') {
          builder.single = vi.fn().mockResolvedValue({ data: service, error: null });
        } else if (table === 'bookings') {
          builder.single = vi.fn().mockResolvedValue({ data: [], error: null });
        } else if (table === 'gift_cards') {
          builder.single = vi.fn().mockResolvedValue({ data: expiredGiftCard, error: null });
        }
        return builder;
      });

      (mockRequest.json as any).mockResolvedValue({
        service_id: 'svc-123',
        staff_id: 'staff-123',
        start_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        customer: { name: 'John Doe', email: 'john@example.com' },
        gift_card_code: 'EXPIRED',
      });

      const response = await POST(mockRequest, { params: { slug: 'testsalon' } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('expired');
    });

    it('should reject invalid gift card code', async () => {
      const business = createMockBusiness({ subdomain: 'testsalon' });
      const service = createMockService();

      mockSupabase.from.mockImplementation((table: string) => {
        const builder = createChainableBuilder();
        if (table === 'businesses') {
          builder.single = vi.fn().mockResolvedValue({ data: business, error: null });
        } else if (table === 'services') {
          builder.single = vi.fn().mockResolvedValue({ data: service, error: null });
        } else if (table === 'bookings') {
          builder.single = vi.fn().mockResolvedValue({ data: [], error: null });
        } else if (table === 'gift_cards') {
          builder.single = vi.fn().mockResolvedValue({
            data: null,
            error: { code: 'PGRST116' }, // Not found
          });
        }
        return builder;
      });

      (mockRequest.json as any).mockResolvedValue({
        service_id: 'svc-123',
        staff_id: 'staff-123',
        start_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        customer: { name: 'John Doe', email: 'john@example.com' },
        gift_card_code: 'INVALID',
      });

      const response = await POST(mockRequest, { params: { slug: 'testsalon' } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid gift card code');
    });
  });
});

