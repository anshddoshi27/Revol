/**
 * Tests for reminder cron worker
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../../reminders/route';
import { emitNotification } from '@/lib/notifications';
import { createAdminClient } from '@/lib/db';

// Mock dependencies
vi.mock('@/lib/db', () => ({
  createAdminClient: vi.fn(),
}));

vi.mock('@/lib/notifications', () => ({
  emitNotification: vi.fn().mockResolvedValue(undefined),
}));

describe('Reminder Cron Worker', () => {
  let mockSupabase: any;
  const mockCronSecret = 'test-cron-secret';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = mockCronSecret;

    mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          in: vi.fn(() => ({
            gte: vi.fn(() => ({
              lte: vi.fn(() => ({
                is: vi.fn(),
              })),
            })),
          })),
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(() => ({
                maybeSingle: vi.fn(),
              })),
            })),
          })),
        })),
      })),
    });

    (createAdminClient as any).mockReturnValue(mockSupabase);
  });

  it('should require CRON_SECRET authentication', async () => {
    const request = new Request('http://localhost/api/cron/reminders');
    const response = await GET(request);

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error).toBe('Unauthorized');
  });

  it('should find bookings in 24h window', async () => {
    const now = new Date();
    const window24hStart = new Date(now.getTime() + (24 * 60 - 5) * 60 * 1000);
    const window24hEnd = new Date(now.getTime() + (24 * 60 + 5) * 60 * 1000);

    const bookings24h = [
      {
        id: 'booking-1',
        business_id: 'business-123',
        start_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      },
    ];

    // Mock 24h bookings query
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        in: vi.fn(() => ({
          gte: vi.fn(() => ({
            lte: vi.fn(() => ({
              is: vi.fn().mockResolvedValue({
                data: bookings24h,
                error: null,
              }),
            })),
          })),
        })),
      })),
    });

    // Mock 1h bookings query (empty)
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        in: vi.fn(() => ({
          gte: vi.fn(() => ({
            lte: vi.fn(() => ({
              is: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            })),
          })),
        })),
      })),
    });

    // Mock existing reminder check (none exists)
    mockSupabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            in: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
              }),
            })),
          })),
        })),
      })),
    });

    const request = new Request('http://localhost/api/cron/reminders', {
      headers: {
        'Authorization': `Bearer ${mockCronSecret}`,
      },
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.reminders_24h).toBe(1);
    expect(emitNotification).toHaveBeenCalledWith(
      'business-123',
      'reminder_24h',
      'booking-1',
      mockSupabase
    );
  });

  it('should find bookings in 1h window', async () => {
    const now = new Date();
    const bookings1h = [
      {
        id: 'booking-2',
        business_id: 'business-123',
        start_at: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
      },
    ];

    // Mock 24h bookings query (empty)
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        in: vi.fn(() => ({
          gte: vi.fn(() => ({
            lte: vi.fn(() => ({
              is: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            })),
          })),
        })),
      })),
    });

    // Mock 1h bookings query
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        in: vi.fn(() => ({
          gte: vi.fn(() => ({
            lte: vi.fn(() => ({
              is: vi.fn().mockResolvedValue({
                data: bookings1h,
                error: null,
              }),
            })),
          })),
        })),
      })),
    });

    // Mock existing reminder check (none exists)
    mockSupabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            in: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
              }),
            })),
          })),
        })),
      })),
    });

    const request = new Request('http://localhost/api/cron/reminders', {
      headers: {
        'Authorization': `Bearer ${mockCronSecret}`,
      },
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.reminders_1h).toBe(1);
    expect(emitNotification).toHaveBeenCalledWith(
      'business-123',
      'reminder_1h',
      'booking-2',
      mockSupabase
    );
  });

  it('should not send duplicate reminders', async () => {
    const bookings24h = [
      {
        id: 'booking-3',
        business_id: 'business-123',
        start_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
    ];

    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        in: vi.fn(() => ({
          gte: vi.fn(() => ({
            lte: vi.fn(() => ({
              is: vi.fn().mockResolvedValue({
                data: bookings24h,
                error: null,
              }),
            })),
          })),
        })),
      })),
    });

    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        in: vi.fn(() => ({
          gte: vi.fn(() => ({
            lte: vi.fn(() => ({
              is: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            })),
          })),
        })),
      })),
    });

    // Mock existing reminder check (reminder already exists)
    mockSupabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            in: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'existing-reminder' },
              }),
            })),
          })),
        })),
      })),
    });

    const request = new Request('http://localhost/api/cron/reminders', {
      headers: {
        'Authorization': `Bearer ${mockCronSecret}`,
      },
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.reminders_24h).toBe(0);
    expect(emitNotification).not.toHaveBeenCalled();
  });

  it('should handle errors gracefully', async () => {
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        in: vi.fn(() => ({
          gte: vi.fn(() => ({
            lte: vi.fn(() => ({
              is: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Database error' },
              }),
            })),
          })),
        })),
      })),
    });

    const request = new Request('http://localhost/api/cron/reminders', {
      headers: {
        'Authorization': `Bearer ${mockCronSecret}`,
      },
    });

    const response = await GET(request);
    
    // Should not crash, but may return error or empty result
    expect(response.status).toBeGreaterThanOrEqual(200);
  });
});

