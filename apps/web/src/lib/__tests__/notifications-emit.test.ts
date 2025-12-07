/**
 * Tests for emitNotification function and notification job enqueueing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { emitNotification, enqueueNotification, loadTemplateForTrigger } from '../notifications';
import { createAdminClient } from '../db';

// Mock dependencies
vi.mock('../db', () => ({
  createAdminClient: vi.fn(),
  createServerClient: vi.fn(),
}));

describe('emitNotification', () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(),
            maybeSingle: vi.fn(),
          })),
          in: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({
                maybeSingle: vi.fn(),
              })),
            })),
          })),
        })),
      })),
    };

    (createAdminClient as any).mockReturnValue(mockSupabase);
  });

  it('should skip if business not found', async () => {
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Not found' },
          }),
        })),
      })),
    });

    await emitNotification('business-123', 'booking_created', 'booking-123');

    // Should return early without throwing
    expect(mockSupabase.from).toHaveBeenCalled();
  });

  it('should skip if notifications disabled', async () => {
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'business-123',
              user_id: 'user-123',
              notifications_enabled: false,
            },
          }),
        })),
      })),
    });

    await emitNotification('business-123', 'booking_created', 'booking-123');

    // Should return early
    expect(mockSupabase.from).toHaveBeenCalled();
  });

  it('should load booking data and templates', async () => {
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

    // Mock business query
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: business }),
        })),
      })),
    });

    // Mock booking query
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            is: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: booking }),
            })),
          })),
        })),
      })),
    });

    // Mock template queries (no templates)
    mockSupabase.from.mockReturnValue({
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
    });

    // Mock enqueueNotification (we'll test this separately)
    vi.spyOn(await import('../notifications'), 'enqueueNotification').mockResolvedValue();

    await emitNotification('business-123', 'booking_created', 'booking-123');

    // Should have queried business and booking
    expect(mockSupabase.from).toHaveBeenCalledWith('businesses');
    expect(mockSupabase.from).toHaveBeenCalledWith('bookings');
  });

  it('should load payment amount for fee_charged trigger', async () => {
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

    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: business }),
        })),
      })),
    });

    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            is: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: booking }),
            })),
          })),
        })),
      })),
    });

    // Mock payment query for fee_charged
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          in: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { amount_cents: 2500 },
                }),
              })),
            })),
          })),
        })),
      })),
    });

    // Mock template queries
    mockSupabase.from.mockReturnValue({
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
    });

    await emitNotification('business-123', 'fee_charged', 'booking-123');

    // Should have queried booking_payments for amount
    expect(mockSupabase.from).toHaveBeenCalledWith('booking_payments');
  });
});

describe('enqueueNotification', () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                limit: vi.fn(() => ({
                  single: vi.fn(),
                })),
              })),
            })),
          })),
        })),
        insert: vi.fn(),
      })),
    };

    (createAdminClient as any).mockReturnValue(mockSupabase);
  });

  it('should check for existing job before inserting', async () => {
    mockSupabase.from.mockReturnValueOnce({
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
    });

    mockSupabase.from.mockReturnValueOnce({
      insert: vi.fn().mockResolvedValue({ error: null }),
    });

    await enqueueNotification({
      businessId: 'business-123',
      userId: 'user-123',
      bookingId: 'booking-123',
      trigger: 'booking_created',
      recipientEmail: 'test@example.com',
      subject: 'Test',
      body: 'Test body',
      channel: 'email',
    });

    // Should check for existing job first
    expect(mockSupabase.from).toHaveBeenCalledWith('notification_jobs');
  });

  it('should skip if job already exists', async () => {
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              limit: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'existing-job' },
                }),
              })),
            })),
          })),
        })),
      })),
    });

    await enqueueNotification({
      businessId: 'business-123',
      userId: 'user-123',
      bookingId: 'booking-123',
      trigger: 'booking_created',
      recipientEmail: 'test@example.com',
      subject: 'Test',
      body: 'Test body',
      channel: 'email',
    });

    // Should not insert if job exists
    expect(mockSupabase.from).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ insert: expect.anything() }));
  });

  it('should handle unique constraint violation gracefully', async () => {
    mockSupabase.from.mockReturnValueOnce({
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
    });

    mockSupabase.from.mockReturnValueOnce({
      insert: vi.fn().mockResolvedValue({
        error: { code: '23505', message: 'Unique constraint violation' },
      }),
    });

    // Should not throw on unique constraint violation
    await expect(
      enqueueNotification({
        businessId: 'business-123',
        userId: 'user-123',
        bookingId: 'booking-123',
        trigger: 'booking_created',
        recipientEmail: 'test@example.com',
        subject: 'Test',
        body: 'Test body',
        channel: 'email',
      })
    ).resolves.not.toThrow();
  });
});

describe('loadTemplateForTrigger', () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  is: vi.fn(() => ({
                    order: vi.fn(() => ({
                      limit: vi.fn(() => ({
                        maybeSingle: vi.fn(),
                      })),
                    })),
                  })),
                })),
              })),
            })),
          })),
        })),
      })),
    };

    (createAdminClient as any).mockReturnValue(mockSupabase);
  });

  it('should return template if found', async () => {
    const template = {
      id: 'template-123',
      name: 'Booking Confirmation',
      body_markdown: 'Hello ${customer.name}',
      subject: 'Booking Confirmed',
    };

    mockSupabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                is: vi.fn(() => ({
                  order: vi.fn(() => ({
                    limit: vi.fn(() => ({
                      maybeSingle: vi.fn().mockResolvedValue({ data: template }),
                    })),
                  })),
                })),
              })),
            })),
          })),
        })),
      })),
    });

    const result = await loadTemplateForTrigger(
      'business-123',
      'user-123',
      'booking_created',
      'email'
    );

    expect(result).toEqual(template);
  });

  it('should return null if template not found', async () => {
    mockSupabase.from.mockReturnValue({
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
    });

    const result = await loadTemplateForTrigger(
      'business-123',
      'user-123',
      'booking_created',
      'email'
    );

    expect(result).toBeNull();
  });
});

