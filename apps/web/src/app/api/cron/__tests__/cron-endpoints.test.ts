/**
 * Comprehensive tests for Task 11: Background Jobs & Cron Endpoints
 * 
 * Tests all cron endpoints:
 * - /api/cron/reminders
 * - /api/cron/subscription-health
 * - /api/cron/cleanup
 * - /api/cron/notifications (already tested separately)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from '../reminders/route';
import { GET as getSubscriptionHealth } from '../subscription-health/route';
import { GET as getCleanup } from '../cleanup/route';
import { createAdminClient } from '@/lib/db';
import { emitNotification } from '@/lib/notifications';
import { getStripeClient } from '@/lib/stripe';

// Mock dependencies
vi.mock('@/lib/db', () => ({
  createAdminClient: vi.fn(),
}));

vi.mock('@/lib/notifications', () => ({
  emitNotification: vi.fn(),
}));

vi.mock('@/lib/stripe', () => ({
  getStripeClient: vi.fn(),
}));

describe('Cron Endpoints - Task 11', () => {
  const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
    single: vi.fn(),
  };

  const mockRequest = (authHeader?: string) => {
    const headers = new Headers();
    if (authHeader) {
      headers.set('authorization', authHeader);
    }
    return {
      headers,
      get: (key: string) => headers.get(key),
    } as unknown as Request;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-secret';
    (createAdminClient as any).mockReturnValue(mockSupabase);
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  describe('GET /api/cron/reminders', () => {
    it('should return 401 if CRON_SECRET is missing', async () => {
      delete process.env.CRON_SECRET;
      const request = mockRequest('Bearer wrong-secret');
      const response = await GET(request);
      expect(response.status).toBe(401);
    });

    it('should return 401 if authorization header is missing', async () => {
      const request = mockRequest();
      const response = await GET(request);
      expect(response.status).toBe(401);
    });

    it('should schedule 24h reminders for bookings in window', async () => {
      const now = new Date();
      const booking24h = {
        id: 'booking-1',
        business_id: 'business-1',
        start_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      };

      mockSupabase.select.mockResolvedValueOnce({
        data: [booking24h],
        error: null,
      });

      // Mock check for existing reminder (none exists)
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const request = mockRequest('Bearer test-secret');
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.reminders_24h).toBe(1);
      expect(emitNotification).toHaveBeenCalledWith(
        'business-1',
        'reminder_24h',
        'booking-1',
        mockSupabase
      );
    });

    it('should schedule 1h reminders for bookings in window', async () => {
      const now = new Date();
      const booking1h = {
        id: 'booking-2',
        business_id: 'business-1',
        start_at: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
      };

      // Mock 24h query (empty)
      mockSupabase.select.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      // Mock 1h query
      mockSupabase.select.mockResolvedValueOnce({
        data: [booking1h],
        error: null,
      });

      // Mock check for existing reminder (none exists)
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const request = mockRequest('Bearer test-secret');
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.reminders_1h).toBe(1);
      expect(emitNotification).toHaveBeenCalledWith(
        'business-1',
        'reminder_1h',
        'booking-2',
        mockSupabase
      );
    });

    it('should not schedule duplicate reminders', async () => {
      const now = new Date();
      const booking = {
        id: 'booking-1',
        business_id: 'business-1',
        start_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      };

      mockSupabase.select.mockResolvedValueOnce({
        data: [booking],
        error: null,
      });

      // Mock existing reminder (already sent)
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: { id: 'existing-reminder' },
        error: null,
      });

      const request = mockRequest('Bearer test-secret');
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.reminders_24h).toBe(0);
      expect(emitNotification).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/cron/subscription-health', () => {
    const mockStripe = {
      subscriptions: {
        retrieve: vi.fn(),
      },
    };

    beforeEach(() => {
      (getStripeClient as any).mockReturnValue(mockStripe);
    });

    it('should sync subscription status from Stripe', async () => {
      const business = {
        id: 'business-1',
        user_id: 'user-1',
        stripe_subscription_id: 'sub_123',
        subscription_status: 'active',
      };

      mockSupabase.select.mockResolvedValueOnce({
        data: [business],
        error: null,
      });

      mockStripe.subscriptions.retrieve.mockResolvedValueOnce({
        status: 'active',
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days from now
      });

      mockSupabase.update.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const request = mockRequest('Bearer test-secret');
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.checked).toBe(1);
      expect(mockStripe.subscriptions.retrieve).toHaveBeenCalledWith('sub_123');
    });

    it('should update status when Stripe status differs', async () => {
      const business = {
        id: 'business-1',
        user_id: 'user-1',
        stripe_subscription_id: 'sub_123',
        subscription_status: 'active',
      };

      mockSupabase.select.mockResolvedValueOnce({
        data: [business],
        error: null,
      });

      mockStripe.subscriptions.retrieve.mockResolvedValueOnce({
        status: 'canceled',
        current_period_end: null,
      });

      mockSupabase.update.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const request = mockRequest('Bearer test-secret');
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.updated).toBe(1);
      expect(body.deprovisioned).toBe(1);
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          subscription_status: 'canceled',
          deleted_at: expect.any(String),
        })
      );
    });

    it('should update next_bill_at from Stripe', async () => {
      const business = {
        id: 'business-1',
        user_id: 'user-1',
        stripe_subscription_id: 'sub_123',
        subscription_status: 'active',
      };

      const periodEnd = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

      mockSupabase.select.mockResolvedValueOnce({
        data: [business],
        error: null,
      });

      mockStripe.subscriptions.retrieve.mockResolvedValueOnce({
        status: 'active',
        current_period_end: periodEnd,
      });

      mockSupabase.update.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const request = mockRequest('Bearer test-secret');
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          next_bill_at: expect.any(String),
        })
      );
    });
  });

  describe('GET /api/cron/cleanup', () => {
    it('should expire held bookings without cards', async () => {
      const expiredBooking = {
        id: 'booking-1',
      };

      mockSupabase.select
        .mockResolvedValueOnce({
          data: [expiredBooking],
          error: null,
        })
        .mockResolvedValueOnce({
          data: [expiredBooking], // No card saved
          error: null,
        });

      mockSupabase.delete.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      // Mock idempotency keys cleanup
      mockSupabase.select.mockResolvedValueOnce({
        count: 5,
        error: null,
      });

      mockSupabase.delete.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      // Mock dead jobs query
      mockSupabase.select.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      // Mock old events query
      mockSupabase.select.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const request = mockRequest('Bearer test-secret');
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.expired_holds).toBe(1);
      expect(body.cleaned_keys).toBe(5);
    });

    it('should update held bookings with cards to pending', async () => {
      const expiredBooking = {
        id: 'booking-1',
      };

      mockSupabase.select
        .mockResolvedValueOnce({
          data: [expiredBooking],
          error: null,
        })
        .mockResolvedValueOnce({
          data: [], // No bookings without cards
          error: null,
        })
        .mockResolvedValueOnce({
          data: [expiredBooking], // Has card
          error: null,
        });

      mockSupabase.update.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      // Mock idempotency keys cleanup
      mockSupabase.select.mockResolvedValueOnce({
        count: 0,
        error: null,
      });

      // Mock dead jobs query
      mockSupabase.select.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      // Mock old events query
      mockSupabase.select.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const request = mockRequest('Bearer test-secret');
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'pending',
          held_expires_at: null,
        })
      );
    });

    it('should mark dead notification jobs', async () => {
      const deadJob = {
        id: 'job-1',
      };

      // Mock expired holds (empty)
      mockSupabase.select.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      // Mock idempotency keys cleanup
      mockSupabase.select.mockResolvedValueOnce({
        count: 0,
        error: null,
      });

      // Mock dead jobs query
      mockSupabase.select.mockResolvedValueOnce({
        data: [deadJob],
        error: null,
      });

      mockSupabase.update.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      // Mock old events query
      mockSupabase.select.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const request = mockRequest('Bearer test-secret');
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.dead_jobs).toBe(1);
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'dead',
        })
      );
    });

    it('should handle errors gracefully', async () => {
      mockSupabase.select.mockRejectedValueOnce(new Error('Database error'));

      const request = mockRequest('Bearer test-secret');
      const response = await GET(request);

      expect(response.status).toBe(500);
    });
  });
});



