/**
 * Comprehensive tests for notification cron worker
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../notifications/route';
import { sendEmailViaSendGrid, sendSMSViaTwilio } from '@/lib/notification-senders';
import { createAdminClient } from '@/lib/db';

// Mock dependencies
vi.mock('@/lib/db', () => ({
  createAdminClient: vi.fn(),
}));

vi.mock('@/lib/notification-senders', () => ({
  sendEmailViaSendGrid: vi.fn(),
  sendSMSViaTwilio: vi.fn(),
}));

describe('Notification Cron Worker', () => {
  let mockSupabase: any;
  const mockCronSecret = 'test-cron-secret';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = mockCronSecret;

    mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            lte: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(),
              })),
            })),
            lt: vi.fn(() => ({
              lte: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(),
                })),
              })),
            })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(),
        })),
        insert: vi.fn(),
      })),
    });

    (createAdminClient as any).mockReturnValue(mockSupabase);
  });

  it('should require CRON_SECRET authentication', async () => {
    const request = new Request('http://localhost/api/cron/notifications');
    const response = await GET(request);

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error).toBe('Unauthorized');
  });

  it('should process pending jobs', async () => {
    const pendingJobs = [
      {
        id: 'job-1',
        user_id: 'user-123',
        business_id: 'business-123',
        booking_id: 'booking-123',
        template_id: 'template-123',
        recipient_email: 'customer@example.com',
        recipient_phone: null,
        subject: 'Test Subject',
        body: 'Test body',
        channel: 'email',
        trigger: 'booking_created',
        status: 'pending',
        attempt_count: 0,
        scheduled_at: new Date().toISOString(),
      },
    ];

    // Mock pending jobs query
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          lte: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue({
                data: pendingJobs,
                error: null,
              }),
            })),
          })),
        })),
      })),
    });

    // Mock failed jobs query (empty)
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          lt: vi.fn(() => ({
            lte: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              })),
            })),
          })),
        })),
      })),
    });

    // Mock update to in_progress
    mockSupabase.from.mockReturnValueOnce({
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    });

    // Mock email sender
    (sendEmailViaSendGrid as any).mockResolvedValue({
      success: true,
      messageId: 'email-123',
    });

    // Mock update to sent
    mockSupabase.from.mockReturnValueOnce({
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    });

    // Mock event insert
    mockSupabase.from.mockReturnValueOnce({
      insert: vi.fn().mockResolvedValue({ error: null }),
    });

    const request = new Request('http://localhost/api/cron/notifications', {
      headers: {
        'Authorization': `Bearer ${mockCronSecret}`,
      },
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.processed).toBe(1);
    expect(json.failed).toBe(0);
    expect(sendEmailViaSendGrid).toHaveBeenCalledWith(
      'customer@example.com',
      'Test Subject',
      'Test body'
    );
  });

  it('should process SMS jobs', async () => {
    const smsJob = {
      id: 'job-2',
      user_id: 'user-123',
      business_id: 'business-123',
      recipient_phone: '+1987654321',
      recipient_email: null,
      subject: null,
      body: 'SMS body',
      channel: 'sms',
      status: 'pending',
      attempt_count: 0,
      scheduled_at: new Date().toISOString(),
    };

    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          lte: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue({
                data: [smsJob],
                error: null,
              }),
            })),
          })),
        })),
      })),
    });

    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          lt: vi.fn(() => ({
            lte: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              })),
            })),
          })),
        })),
      })),
    });

    mockSupabase.from.mockReturnValueOnce({
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    });

    (sendSMSViaTwilio as any).mockResolvedValue({
      success: true,
      messageId: 'SM123',
    });

    mockSupabase.from.mockReturnValueOnce({
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    });

    mockSupabase.from.mockReturnValueOnce({
      insert: vi.fn().mockResolvedValue({ error: null }),
    });

    const request = new Request('http://localhost/api/cron/notifications', {
      headers: {
        'Authorization': `Bearer ${mockCronSecret}`,
      },
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.processed).toBe(1);
    expect(sendSMSViaTwilio).toHaveBeenCalledWith('+1987654321', 'SMS body');
  });

  it('should handle failed sends with exponential backoff', async () => {
    const failedJob = {
      id: 'job-3',
      user_id: 'user-123',
      business_id: 'business-123',
      recipient_email: 'customer@example.com',
      subject: 'Test',
      body: 'Test body',
      channel: 'email',
      status: 'failed',
      attempt_count: 1,
      scheduled_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(), // 20 min ago
      next_retry_at: new Date().toISOString(), // Ready for retry
    };

    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          lte: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            })),
          })),
        })),
      })),
    });

    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          lt: vi.fn(() => ({
            lte: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue({
                  data: [failedJob],
                  error: null,
                }),
              })),
            })),
          })),
        })),
      })),
    });

    mockSupabase.from.mockReturnValueOnce({
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    });

    (sendEmailViaSendGrid as any).mockResolvedValue({
      success: false,
      error: 'API error',
    });

    // Mock update to failed with next_retry_at
    mockSupabase.from.mockReturnValueOnce({
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    });

    const request = new Request('http://localhost/api/cron/notifications', {
      headers: {
        'Authorization': `Bearer ${mockCronSecret}`,
      },
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.failed).toBe(1);
    
    // Verify update was called with next_retry_at (30 min from now for attempt 2)
    const updateCall = mockSupabase.from.mock.calls.find(
      (call: any) => call[0] === 'notification_jobs' && mockSupabase.from().update
    );
    expect(updateCall).toBeDefined();
  });

  it('should mark jobs as dead after 3 failed attempts', async () => {
    const deadJob = {
      id: 'job-4',
      user_id: 'user-123',
      business_id: 'business-123',
      recipient_email: 'customer@example.com',
      subject: 'Test',
      body: 'Test body',
      channel: 'email',
      status: 'failed',
      attempt_count: 2, // Will become 3
      scheduled_at: new Date().toISOString(),
      next_retry_at: new Date().toISOString(),
    };

    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          lte: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            })),
          })),
        })),
      })),
    });

    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          lt: vi.fn(() => ({
            lte: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue({
                  data: [deadJob],
                  error: null,
                }),
              })),
            })),
          })),
        })),
      })),
    });

    mockSupabase.from.mockReturnValueOnce({
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    });

    (sendEmailViaSendGrid as any).mockResolvedValue({
      success: false,
      error: 'Final failure',
    });

    // Mock update to dead
    let updateCalled = false;
    mockSupabase.from.mockReturnValueOnce({
      update: vi.fn((data: any) => {
        updateCalled = true;
        // Verify status is 'dead' and next_retry_at is null
        expect(data.status).toBe('dead');
        return {
          eq: vi.fn().mockResolvedValue({ error: null }),
        };
      }),
    });

    const request = new Request('http://localhost/api/cron/notifications', {
      headers: {
        'Authorization': `Bearer ${mockCronSecret}`,
      },
    });

    await GET(request);
    expect(updateCalled).toBe(true);
  });

  it('should handle missing recipient email/phone', async () => {
    const invalidJob = {
      id: 'job-5',
      channel: 'email',
      recipient_email: null, // Missing
      subject: 'Test',
      body: 'Test body',
      status: 'pending',
      attempt_count: 0,
      scheduled_at: new Date().toISOString(),
    };

    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          lte: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue({
                data: [invalidJob],
                error: null,
              }),
            })),
          })),
        })),
      })),
    });

    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          lt: vi.fn(() => ({
            lte: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              })),
            })),
          })),
        })),
      })),
    });

    mockSupabase.from.mockReturnValueOnce({
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    });

    // Should not call sender
    mockSupabase.from.mockReturnValueOnce({
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    });

    const request = new Request('http://localhost/api/cron/notifications', {
      headers: {
        'Authorization': `Bearer ${mockCronSecret}`,
      },
    });

    const response = await GET(request);
    const json = await response.json();

    expect(json.failed).toBe(1);
    expect(sendEmailViaSendGrid).not.toHaveBeenCalled();
  });

  it('should return empty result when no jobs', async () => {
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          lte: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            })),
          })),
        })),
      })),
    });

    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          lt: vi.fn(() => ({
            lte: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              })),
            })),
          })),
        })),
      })),
    });

    const request = new Request('http://localhost/api/cron/notifications', {
      headers: {
        'Authorization': `Bearer ${mockCronSecret}`,
      },
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.processed).toBe(0);
    expect(json.failed).toBe(0);
    expect(json.message).toContain('No pending notifications');
  });
});

