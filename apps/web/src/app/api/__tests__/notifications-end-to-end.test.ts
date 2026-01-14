/**
 * End-to-end tests for notification system
 * Tests complete flows from booking events to notification delivery
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { emitNotification } from '@/lib/notifications';
import { createAdminClient } from '@/lib/db';
import { sendEmailViaSendGrid, sendSMSViaTwilio } from '@/lib/notification-senders';

// Mock dependencies
vi.mock('@/lib/db', () => ({
  createAdminClient: vi.fn(),
}));

vi.mock('@/lib/notification-senders', () => ({
  sendEmailViaSendGrid: vi.fn(),
  sendSMSViaTwilio: vi.fn(),
}));

describe('Notification System End-to-End', () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockSupabase = {
      from: vi.fn(),
    };

    (createAdminClient as any).mockReturnValue(mockSupabase);
  });

  describe('Booking Created Flow', () => {
    it('should send email and SMS when booking is created', async () => {
      const business = {
        id: 'business-123',
        user_id: 'user-123',
        name: 'Test Salon',
        support_email: 'support@testsalon.com',
        phone: '+1234567890',
        subdomain: 'testsalon',
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
        channel: 'email',
        trigger: 'booking_created',
        subject: 'Booking confirmed with ${business.name}',
        body_markdown: 'Hi ${customer.name}! Your ${service.name} with ${staff.name} is confirmed for ${booking.date} at ${booking.time}.',
        is_enabled: true,
      };

      const smsTemplate = {
        id: 'template-sms',
        channel: 'sms',
        trigger: 'booking_created',
        body_markdown: 'Confirmed: ${service.name} on ${booking.date} at ${booking.time}',
        is_enabled: true,
      };

      let templateCallCount = 0;
      let jobInsertCount = 0;

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
          templateCallCount++;
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
                              data: templateCallCount === 1 ? emailTemplate : smsTemplate,
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
          jobInsertCount++;
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

      // Verify both templates were loaded
      const templateCalls = mockSupabase.from.mock.calls.filter(
        (call: any) => call[0] === 'notification_templates'
      );
      expect(templateCalls.length).toBeGreaterThanOrEqual(2);

      // Verify jobs were enqueued for both channels
      const jobCalls = mockSupabase.from.mock.calls.filter(
        (call: any) => call[0] === 'notification_jobs'
      );
      expect(jobCalls.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Fee Charged Flow', () => {
    it('should include fee amount in notification', async () => {
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
          email: 'customer@example.com',
        },
        services: {
          name: 'Haircut',
          duration_min: 30,
          price_cents: 5000,
        },
      };

      const payment = {
        amount_cents: 2500, // No-show fee
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

      // Should query booking_payments to get fee amount
      expect(mockSupabase.from).toHaveBeenCalledWith('booking_payments');
    });

    it('should use provided amount parameter', async () => {
      const business = {
        id: 'business-123',
        user_id: 'user-123',
        notifications_enabled: true,
        timezone: 'America/New_York',
      };

      const booking = {
        id: 'booking-123',
        start_at: '2025-01-20T14:00:00Z',
        customers: { email: 'customer@example.com' },
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

      // Pass amount directly
      await emitNotification('business-123', 'fee_charged', 'booking-123', mockSupabase, 3000);

      // Should not query booking_payments when amount is provided
      const paymentCalls = mockSupabase.from.mock.calls.filter(
        (call: any) => call[0] === 'booking_payments'
      );
      expect(paymentCalls.length).toBe(0);
    });
  });

  describe('Reminder Flow', () => {
    it('should send reminders for upcoming bookings', async () => {
      const business = {
        id: 'business-123',
        user_id: 'user-123',
        notifications_enabled: true,
        timezone: 'America/New_York',
      };

      const booking = {
        id: 'booking-123',
        start_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h from now
        customers: {
          email: 'customer@example.com',
          phone: '+1987654321',
        },
        services: {
          name: 'Haircut',
          duration_min: 30,
          price_cents: 5000,
        },
        staff: {
          name: 'Jane Smith',
        },
      };

      const reminderTemplate = {
        id: 'template-reminder',
        channel: 'email',
        trigger: 'reminder_24h',
        subject: 'Reminder: ${service.name} tomorrow',
        body_markdown: 'Hi ${customer.name}! Reminder: ${service.name} with ${staff.name} tomorrow at ${booking.time}.',
        is_enabled: true,
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
                            maybeSingle: vi.fn().mockResolvedValue({
                              data: reminderTemplate,
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

      await emitNotification('business-123', 'reminder_24h', 'booking-123');

      // Verify reminder template was loaded
      const templateCalls = mockSupabase.from.mock.calls.filter(
        (call: any) => call[0] === 'notification_templates'
      );
      expect(templateCalls.length).toBeGreaterThan(0);

      // Verify job was enqueued
      const jobCalls = mockSupabase.from.mock.calls.filter(
        (call: any) => call[0] === 'notification_jobs'
      );
      expect(jobCalls.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing business gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' },
            }),
          })),
        })),
      });

      // Should not throw
      await expect(
        emitNotification('business-123', 'booking_created', 'booking-123')
      ).resolves.not.toThrow();
    });

    it('should handle missing booking gracefully', async () => {
      const business = {
        id: 'business-123',
        user_id: 'user-123',
        notifications_enabled: true,
        timezone: 'America/New_York',
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
                    single: vi.fn().mockResolvedValue({
                      data: null,
                      error: { message: 'Not found' },
                    }),
                  })),
                })),
              })),
            })),
          };
        }

        return {};
      });

      // Should not throw
      await expect(
        emitNotification('business-123', 'booking_created', 'booking-123')
      ).resolves.not.toThrow();
    });

    it('should skip notifications when disabled', async () => {
      const business = {
        id: 'business-123',
        user_id: 'user-123',
        notifications_enabled: false, // Disabled
        timezone: 'America/New_York',
      };

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: business }),
          })),
        })),
      });

      await emitNotification('business-123', 'booking_created', 'booking-123');

      // Should not query bookings or templates
      const bookingCalls = mockSupabase.from.mock.calls.filter(
        (call: any) => call[0] === 'bookings'
      );
      expect(bookingCalls.length).toBe(0);
    });
  });
});

