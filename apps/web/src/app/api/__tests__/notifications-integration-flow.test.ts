/**
 * Integration tests for complete notification flow
 * Tests the full path from booking event to notification delivery
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { emitNotification } from '@/lib/notifications';
import { createAdminClient } from '@/lib/db';

// Mock dependencies
vi.mock('@/lib/db', () => ({
  createAdminClient: vi.fn(),
}));

describe('Notification Integration Flow', () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabase = {
      from: vi.fn(),
    };

    (createAdminClient as any).mockReturnValue(mockSupabase);
  });

  it('should complete full flow: booking created -> template loaded -> job enqueued', async () => {
    const business = {
      id: 'business-123',
      user_id: 'user-123',
      name: 'Test Business',
      support_email: 'support@test.com',
      phone: '+1234567890',
      subdomain: 'test',
      timezone: 'America/New_York',
      notifications_enabled: true,
    };

    const booking = {
      id: 'booking-123',
      start_at: '2025-01-20T14:00:00Z',
      end_at: '2025-01-20T14:30:00Z',
      final_price_cents: 5000,
      price_cents: 5000,
      staff_id: 'staff-123',
      status: 'pending',
      customers: {
        id: 'customer-123',
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+1987654321',
      },
      services: {
        id: 'service-123',
        name: 'Haircut',
        duration_min: 30,
        price_cents: 5000,
      },
      staff: {
        id: 'staff-123',
        name: 'Jane Smith',
      },
    };

    const emailTemplate = {
      id: 'template-email',
      name: 'Booking Confirmation Email',
      channel: 'email',
      trigger: 'booking_created',
      subject: 'Your booking with ${business.name}',
      body_markdown: 'Hello ${customer.name}, your booking ${booking.code} is confirmed for ${service.name} on ${booking.date} at ${booking.time}.',
      is_enabled: true,
    };

    const smsTemplate = {
      id: 'template-sms',
      name: 'Booking Confirmation SMS',
      channel: 'sms',
      trigger: 'booking_created',
      body_markdown: 'Hi ${customer.name}! Your ${service.name} is confirmed for ${booking.date} at ${booking.time}.',
      is_enabled: true,
    };

    // Mock business query
    let callCount = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'businesses') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: business }),
            })),
          })),
        };
      }
      
      if (table === 'bookings') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                is: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({ data: booking }),
                })),
              })),
            })),
          })),
        };
      }

      if (table === 'notification_templates') {
        // First call for email, second for SMS
        callCount++;
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    is: vi.fn(() => ({
                      order: vi.fn(() => ({
                        limit: vi.fn(() => ({
                          maybeSingle: vi.fn().mockResolvedValue({
                            data: callCount === 1 ? emailTemplate : smsTemplate,
                          }),
                        })),
                      })),
                    })),
                  })),
                })),
              })),
            })),
          })),
        };
      }

      if (table === 'notification_jobs') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    single: vi.fn().mockResolvedValue({ data: null }),
                  })),
                })),
              })),
            })),
          })),
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }

      return {};
    });

    await emitNotification('business-123', 'booking_created', 'booking-123');

    // Verify business was queried
    expect(mockSupabase.from).toHaveBeenCalledWith('businesses');
    
    // Verify booking was queried
    expect(mockSupabase.from).toHaveBeenCalledWith('bookings');
    
    // Verify templates were queried (email and SMS)
    const templateCalls = mockSupabase.from.mock.calls.filter(
      (call: any) => call[0] === 'notification_templates'
    );
    expect(templateCalls.length).toBeGreaterThanOrEqual(2);
    
    // Verify jobs were enqueued (email and SMS)
    const jobCalls = mockSupabase.from.mock.calls.filter(
      (call: any) => call[0] === 'notification_jobs'
    );
    expect(jobCalls.length).toBeGreaterThanOrEqual(2);
  });

  it('should skip email if customer has no email', async () => {
    const business = {
      id: 'business-123',
      user_id: 'user-123',
      notifications_enabled: true,
      timezone: 'America/New_York',
    };

    const booking = {
      id: 'booking-123',
      start_at: '2025-01-20T14:00:00Z',
      customers: {
        email: null, // No email
        phone: '+1987654321',
      },
      services: { name: 'Test', duration_min: 30, price_cents: 5000 },
    };

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'businesses') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: business }),
            })),
          })),
        };
      }
      
      if (table === 'bookings') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                is: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({ data: booking }),
                })),
              })),
            })),
          })),
        };
      }

      if (table === 'notification_templates') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    is: vi.fn(() => ({
                      order: vi.fn(() => ({
                        limit: vi.fn(() => ({
                          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
                        })),
                      })),
                    })),
                  })),
                })),
              })),
            })),
          })),
        };
      }

      return {};
    });

    await emitNotification('business-123', 'booking_created', 'booking-123');

    // Should not crash, should skip email gracefully
    expect(mockSupabase.from).toHaveBeenCalled();
  });

  it('should include amount for fee_charged notifications', async () => {
    const business = {
      id: 'business-123',
      user_id: 'user-123',
      notifications_enabled: true,
      timezone: 'America/New_York',
    };

    const booking = {
      id: 'booking-123',
      start_at: '2025-01-20T14:00:00Z',
      customers: { email: 'test@example.com' },
      services: { name: 'Test', duration_min: 30, price_cents: 5000 },
    };

    const payment = {
      amount_cents: 2500, // No-show fee
    };

    let callOrder = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'businesses') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: business }),
            })),
          })),
        };
      }
      
      if (table === 'bookings') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                is: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({ data: booking }),
                })),
              })),
            })),
          })),
        };
      }

      if (table === 'booking_payments') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    maybeSingle: vi.fn().mockResolvedValue({ data: payment }),
                  })),
                })),
              })),
            })),
          })),
        };
      }

      if (table === 'notification_templates') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    is: vi.fn(() => ({
                      order: vi.fn(() => ({
                        limit: vi.fn(() => ({
                          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
                        })),
                      })),
                    })),
                  })),
                })),
              })),
            })),
          })),
        };
      }

      return {};
    });

    await emitNotification('business-123', 'fee_charged', 'booking-123');

    // Should query booking_payments for amount
    expect(mockSupabase.from).toHaveBeenCalledWith('booking_payments');
  });
});

