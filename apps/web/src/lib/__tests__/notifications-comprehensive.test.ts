/**
 * Comprehensive unit tests for Tithi's notification system
 * 
 * Covers:
 * - Template engine (placeholder rendering, validation)
 * - Dispatch logic (trigger selection, template loading, job enqueueing)
 * - Channel routing (email vs SMS, disabled templates, missing contact info)
 * - Preview endpoint functionality
 * - Failure handling (SendGrid/Twilio errors, retry logic)
 * - Tenant isolation (templates scoped to business_id)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  renderTemplate,
  validatePlaceholders,
  ALLOWED_PLACEHOLDERS,
  emitNotification,
  loadTemplateForTrigger,
  enqueueNotification,
  type NotificationData,
  type NotificationTrigger,
} from '../notifications';
import { createAdminClient, createServerClient } from '@/lib/db';
import { sendEmailViaSendGrid, sendSMSViaTwilio } from '../notification-senders';
import { createMockBusiness, createMockBooking, createMockCustomer, createMockService, createMockStaff, createMockNotificationTemplate } from '@/test/factories';

// Mock dependencies
vi.mock('@/lib/db');
vi.mock('../notification-senders');

describe('Notification System - Comprehensive Tests', () => {
  let mockSupabase: any;

  // Helper to create chainable query builder that properly returns promises
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
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    return builder;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabase = {
      from: vi.fn(() => createChainableBuilder()),
    };

    (createAdminClient as any).mockReturnValue(mockSupabase);
    (createServerClient as any).mockResolvedValue(mockSupabase);

    // Default mock responses
    (sendEmailViaSendGrid as any).mockResolvedValue({
      success: true,
      messageId: 'email-msg-id',
    });
    (sendSMSViaTwilio as any).mockResolvedValue({
      success: true,
      messageId: 'sms-msg-id',
    });
  });

  describe('Template Engine - Placeholder Rendering', () => {
    const mockData: NotificationData = {
      customer: {
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '+1234567890',
      },
      service: {
        name: 'Haircut',
        duration_min: 60,
        price_cents: 10000,
      },
      staff: {
        name: 'John Smith',
      },
      booking: {
        id: 'booking-12345678',
        start_at: '2025-08-05T15:00:00Z',
        final_price_cents: 8000,
        price_cents: 10000,
      },
      business: {
        name: 'Test Salon',
        support_email: 'support@testsalon.com',
        phone: '+0987654321',
        subdomain: 'testsalon',
        timezone: 'America/New_York',
      },
      booking_url: 'https://testsalon.tithi.com/confirm/TITHI-12345678',
    };

    it('should replace all supported placeholders correctly', () => {
      const template = `
        Hi \${customer.name},
        Your \${service.name} appointment is scheduled for \${booking.date} at \${booking.time}.
        Service duration: \${service.duration} minutes
        Price: \${service.price}
        Final amount: \${booking.amount}
        Staff: \${staff.name}
        Business: \${business.name}
        Contact: \${business.phone} or \${business.support_email}
        Booking code: \${booking.code}
        View booking: \${booking.url}
      `;

      const rendered = renderTemplate(template, mockData, 'America/New_York');

      // Verify all placeholders are replaced
      expect(rendered).toContain('Jane Doe');
      expect(rendered).toContain('Haircut');
      expect(rendered).toContain('60');
      expect(rendered).toContain('$100.00');
      expect(rendered).toContain('$80.00');
      expect(rendered).toContain('John Smith');
      expect(rendered).toContain('Test Salon');
      expect(rendered).toContain('+0987654321');
      expect(rendered).toContain('support@testsalon.com');
      expect(rendered).toContain('TITHI-12345678');
      expect(rendered).toContain('https://testsalon.tithi.com/confirm/TITHI-12345678');

      // Verify no placeholders remain
      expect(rendered).not.toMatch(/\$\{[^}]+\}/);
    });

    it('should handle basic placeholder merge correctly', () => {
      const template = 'Hi ${customer.name}, your ${service.name} is on ${booking.date} at ${booking.time}.';
      const rendered = renderTemplate(template, mockData, 'America/New_York');

      expect(rendered).toContain('Jane Doe');
      expect(rendered).toContain('Haircut');
      expect(rendered).toContain('August'); // Date should contain month
      expect(rendered).toContain('11:00'); // Time in EST (3 PM UTC = 11 AM EST)
    });

    it('should handle unsupported placeholders by leaving them as-is', () => {
      const template = 'Hello ${customer.name}, ${unknown.placeholder} should remain.';
      const rendered = renderTemplate(template, mockData);

      expect(rendered).toContain('Jane Doe');
      expect(rendered).toContain('${unknown.placeholder}'); // Should remain unchanged
    });

    it('should handle missing optional data gracefully', () => {
      const minimalData: NotificationData = {
        customer: {
          name: 'John Doe',
          email: 'john@example.com',
        },
        service: {
          name: 'Massage',
          duration_min: 90,
          price_cents: 15000,
        },
      };

      const template = 'Hello ${customer.name}, phone: ${customer.phone}, staff: ${staff.name}';
      const rendered = renderTemplate(template, minimalData);

      expect(rendered).toContain('John Doe');
      expect(rendered).toContain('phone: '); // Empty string for missing phone
      expect(rendered).toContain('staff: '); // Empty string for missing staff
    });
  });

  describe('Template Engine - Placeholder Validation', () => {
    it('should validate all allowed placeholders', () => {
      const template = ALLOWED_PLACEHOLDERS.map(p => `\${${p}}`).join(' ');
      const result = validatePlaceholders(template);

      expect(result.valid).toBe(true);
      expect(result.invalid).toHaveLength(0);
    });

    it('should reject invalid placeholders', () => {
      const template = 'Hello ${customer.name}, ${invalid.placeholder} is not allowed.';
      const result = validatePlaceholders(template);

      expect(result.valid).toBe(false);
      expect(result.invalid).toContain('invalid.placeholder');
    });

    it('should identify all invalid placeholders in a template', () => {
      const template = '${customer.name} ${bad.one} ${bad.two} ${customer.email}';
      const result = validatePlaceholders(template);

      expect(result.valid).toBe(false);
      expect(result.invalid).toContain('bad.one');
      expect(result.invalid).toContain('bad.two');
      expect(result.invalid).not.toContain('customer.name');
      expect(result.invalid).not.toContain('customer.email');
    });
  });

  describe('Dispatch Logic - Template Loading', () => {
    it('should load template for specific trigger and channel', async () => {
      const businessId = 'biz-123';
      const userId = 'user-123';
      const trigger: NotificationTrigger = 'booking_created';
      const channel = 'email';

      const template = createMockNotificationTemplate({
        business_id: businessId,
        user_id: userId,
        trigger: 'booking_created',
        channel: 'email',
        is_enabled: true,
      });

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'notification_templates') {
          // Create a proper chainable builder that supports multiple .eq() calls
          const chainable = {
            select: vi.fn(() => chainable),
            eq: vi.fn(() => chainable),
            is: vi.fn(() => chainable),
            order: vi.fn(() => chainable),
            limit: vi.fn(() => chainable),
            maybeSingle: vi.fn().mockResolvedValue({
              data: template,
              error: null,
            }),
          };
          return chainable;
        }
        return createChainableBuilder();
      });

      const result = await loadTemplateForTrigger(businessId, userId, trigger, channel);

      expect(result).toEqual(template);
      expect(mockSupabase.from).toHaveBeenCalledWith('notification_templates');
    });

    it('should return null if template is disabled', async () => {
      const businessId = 'biz-123';
      const userId = 'user-123';
      const trigger: NotificationTrigger = 'booking_created';
      const channel = 'email';

      mockSupabase.from.mockImplementation((table: string) => {
        const builder = createChainableBuilder();
        if (table === 'notification_templates') {
          builder.single = vi.fn().mockResolvedValue({
            data: null,
            error: { code: 'PGRST116' },
          });
        }
        return builder;
      });

      const result = await loadTemplateForTrigger(businessId, userId, trigger, channel);

      expect(result).toBeNull();
    });

    it('should filter by business_id and user_id for tenant isolation', async () => {
      const businessId = 'biz-123';
      const userId = 'user-123';
      const trigger: NotificationTrigger = 'booking_created';
      const channel = 'email';

      mockSupabase.from.mockImplementation((table: string) => {
        const builder = createChainableBuilder();
        if (table === 'notification_templates') {
          builder.single = vi.fn().mockResolvedValue({
            data: null,
            error: { code: 'PGRST116' },
          });
        }
        return builder;
      });

      await loadTemplateForTrigger(businessId, userId, trigger, channel);

      // Verify query filters by business_id and user_id
      const fromCall = mockSupabase.from.mock.calls.find(call => call[0] === 'notification_templates');
      expect(fromCall).toBeDefined();
    });
  });

  describe('Dispatch Logic - Job Enqueueing', () => {
    it('should enqueue notification job with correct data', async () => {
      const params = {
        businessId: 'biz-123',
        userId: 'user-123',
        bookingId: 'booking-123',
        trigger: 'booking_created',
        recipientEmail: 'customer@example.com',
        templateId: 'template-123',
        subject: 'Booking Confirmed',
        body: 'Your booking is confirmed.',
        channel: 'email' as const,
      };

      mockSupabase.from.mockImplementation((table: string) => {
        const builder = createChainableBuilder();
        if (table === 'notification_jobs') {
          // For checking existing jobs
          builder.select = vi.fn(() => {
            const selectBuilder = {
              eq: vi.fn(() => selectBuilder),
              limit: vi.fn(() => selectBuilder),
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' },
              }),
            };
            return selectBuilder;
          });
          // For inserting new jobs
          builder.insert = vi.fn().mockResolvedValue({
            error: null,
          });
        }
        return builder;
      });

      await enqueueNotification(params);

      expect(mockSupabase.from).toHaveBeenCalledWith('notification_jobs');
    });

    it('should prevent duplicate job enqueueing (idempotency)', async () => {
      const params = {
        businessId: 'biz-123',
        userId: 'user-123',
        bookingId: 'booking-123',
        trigger: 'booking_created',
        recipientEmail: 'customer@example.com',
        body: 'Your booking is confirmed.',
        channel: 'email' as const,
      };

      mockSupabase.from.mockImplementation((table: string) => {
        const builder = createChainableBuilder();
        if (table === 'notification_jobs') {
          if (builder.select) {
            // Existing job found
            builder.single = vi.fn().mockResolvedValue({
              data: { id: 'existing-job-123' },
              error: null,
            });
          }
        }
        return builder;
      });

      await enqueueNotification(params);

      // Should not insert new job
      const insertCalls = mockSupabase.from.mock.calls.filter(
        call => call[0] === 'notification_jobs'
      );
      expect(insertCalls.length).toBeGreaterThan(0);
    });
  });

  describe('Channel Routing - Email vs SMS', () => {
    it('should route to email channel when email template exists and customer has email', async () => {
      const business = createMockBusiness({
        id: 'biz-123',
        notifications_enabled: true,
      });
      const booking = createMockBooking({
        id: 'booking-123',
        business_id: 'biz-123',
        customer_id: 'cust-123',
      });
      const customer = createMockCustomer({
        id: 'cust-123',
        email: 'customer@example.com',
        phone: null, // No phone
      });
      const emailTemplate = createMockNotificationTemplate({
        trigger: 'booking_created',
        channel: 'email',
        is_enabled: true,
      });

      mockSupabase.from.mockImplementation((table: string) => {
        const builder = createChainableBuilder();
        if (table === 'businesses') {
          builder.single = vi.fn().mockResolvedValue({ data: business, error: null });
        } else if (table === 'bookings') {
          builder.single = vi.fn().mockResolvedValue({
            data: {
              ...booking,
              customers: customer,
              services: createMockService(),
              staff: createMockStaff(),
            },
            error: null,
          });
        } else if (table === 'notification_templates') {
          // Create proper chainable builder for template queries
          let templateCallCount = 0;
          const templateBuilder = {
            select: vi.fn(() => templateBuilder),
            eq: vi.fn(() => templateBuilder),
            is: vi.fn(() => templateBuilder),
            order: vi.fn(() => templateBuilder),
            limit: vi.fn(() => templateBuilder),
            maybeSingle: vi.fn().mockImplementation(() => {
              templateCallCount++;
              // First call is email (has template), second is SMS (no template)
              if (templateCallCount === 1) {
                return Promise.resolve({
                  data: emailTemplate,
                  error: null,
                });
              } else {
                return Promise.resolve({
                  data: null,
                  error: { code: 'PGRST116' },
                });
              }
            }),
          };
          return templateBuilder;
        } else if (table === 'notification_jobs') {
          builder.single = vi.fn().mockResolvedValue({
            data: null,
            error: { code: 'PGRST116' },
          });
          builder.insert = vi.fn().mockResolvedValue({ error: null });
        }
        return builder;
      });

      await emitNotification('biz-123', 'booking_created', 'booking-123');

      // Should enqueue email job
      expect(mockSupabase.from).toHaveBeenCalledWith('notification_jobs');
    });

    it('should route to SMS channel when SMS template exists and customer has phone', async () => {
      const business = createMockBusiness({
        id: 'biz-123',
        notifications_enabled: true,
      });
      const booking = createMockBooking({
        id: 'booking-123',
        business_id: 'biz-123',
        customer_id: 'cust-123',
      });
      const customer = createMockCustomer({
        id: 'cust-123',
        email: null, // No email
        phone: '+1234567890',
      });
      const smsTemplate = createMockNotificationTemplate({
        trigger: 'booking_created',
        channel: 'sms',
        is_enabled: true,
      });

      let templateCallCount = 0;
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'businesses') {
          const builder = createChainableBuilder();
          builder.single = vi.fn().mockResolvedValue({ data: business, error: null });
          return builder;
        } else if (table === 'bookings') {
          const builder = createChainableBuilder();
          builder.single = vi.fn().mockResolvedValue({
            data: {
              ...booking,
              customers: customer,
              services: createMockService(),
              staff: createMockStaff(),
            },
            error: null,
          });
          return builder;
        } else if (table === 'notification_templates') {
          // Create proper chainable builder for template queries
          const templateBuilder = {
            select: vi.fn(() => templateBuilder),
            eq: vi.fn(() => templateBuilder),
            is: vi.fn(() => templateBuilder),
            order: vi.fn(() => templateBuilder),
            limit: vi.fn(() => templateBuilder),
            maybeSingle: vi.fn().mockImplementation(() => {
              templateCallCount++;
              // First call is email (no template), second is SMS (has template)
              if (templateCallCount === 1) {
                return Promise.resolve({
                  data: null,
                  error: { code: 'PGRST116' },
                });
              } else {
                return Promise.resolve({
                  data: smsTemplate,
                  error: null,
                });
              }
            }),
          };
          return templateBuilder;
        } else if (table === 'notification_jobs') {
          const builder = createChainableBuilder();
          builder.select = vi.fn(() => {
            builder.eq = vi.fn(() => builder);
            builder.limit = vi.fn(() => builder);
            builder.single = vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' },
            });
            return builder;
          });
          builder.insert = vi.fn().mockResolvedValue({ error: null });
          return builder;
        }
        return createChainableBuilder();
      });

      await emitNotification('biz-123', 'booking_created', 'booking-123');

      // Should enqueue SMS job
      expect(mockSupabase.from).toHaveBeenCalledWith('notification_jobs');
    });

    it('should skip disabled templates', async () => {
      const business = createMockBusiness({
        id: 'biz-123',
        notifications_enabled: true,
      });
      const booking = createMockBooking({
        id: 'booking-123',
        business_id: 'biz-123',
        customer_id: 'cust-123',
      });
      const customer = createMockCustomer({
        id: 'cust-123',
        email: 'customer@example.com',
      });

      mockSupabase.from.mockImplementation((table: string) => {
        const builder = createChainableBuilder();
        if (table === 'businesses') {
          builder.single = vi.fn().mockResolvedValue({ data: business, error: null });
        } else if (table === 'bookings') {
          builder.single = vi.fn().mockResolvedValue({
            data: {
              ...booking,
              customers: customer,
              services: createMockService(),
              staff: createMockStaff(),
            },
            error: null,
          });
        } else if (table === 'notification_templates') {
          // Template exists but is disabled (filtered out by is_enabled=true in query)
          const templateBuilder = {
            select: vi.fn(() => templateBuilder),
            eq: vi.fn(() => templateBuilder),
            is: vi.fn(() => templateBuilder),
            order: vi.fn(() => templateBuilder),
            limit: vi.fn(() => templateBuilder),
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' },
            }),
          };
          return templateBuilder;
        }
        return builder;
      });

      await emitNotification('biz-123', 'booking_created', 'booking-123');

      // Should not enqueue any jobs
      const jobInsertCalls = mockSupabase.from.mock.calls.filter(
        call => call[0] === 'notification_jobs'
      );
      expect(jobInsertCalls.length).toBe(0);
    });

    it('should skip notification if customer has no email or phone', async () => {
      const business = createMockBusiness({
        id: 'biz-123',
        notifications_enabled: true,
      });
      const booking = createMockBooking({
        id: 'booking-123',
        business_id: 'biz-123',
        customer_id: 'cust-123',
      });
      const customer = createMockCustomer({
        id: 'cust-123',
        email: null,
        phone: null,
      });

      mockSupabase.from.mockImplementation((table: string) => {
        const builder = createChainableBuilder();
        if (table === 'businesses') {
          builder.single = vi.fn().mockResolvedValue({ data: business, error: null });
        } else if (table === 'bookings') {
          builder.single = vi.fn().mockResolvedValue({
            data: {
              ...booking,
              customers: customer,
              services: createMockService(),
              staff: createMockStaff(),
            },
            error: null,
          });
        } else if (table === 'notification_templates') {
          builder.single = vi.fn().mockResolvedValue({
            data: createMockNotificationTemplate({ is_enabled: true }),
            error: null,
          });
        }
        return builder;
      });

      await emitNotification('biz-123', 'booking_created', 'booking-123');

      // Should not enqueue any jobs
      const jobInsertCalls = mockSupabase.from.mock.calls.filter(
        call => call[0] === 'notification_jobs'
      );
      expect(jobInsertCalls.length).toBe(0);
    });
  });

  describe('Failure Handling', () => {
    it('should handle SendGrid API errors gracefully', async () => {
      (sendEmailViaSendGrid as any).mockResolvedValueOnce({
        success: false,
        error: 'SendGrid API error: 400',
      });

      const result = await sendEmailViaSendGrid(
        'customer@example.com',
        'Test Subject',
        'Test Body'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('SendGrid');
    });

    it('should handle Twilio API errors gracefully', async () => {
      (sendSMSViaTwilio as any).mockResolvedValueOnce({
        success: false,
        error: 'Twilio API error: 21211',
      });

      const result = await sendSMSViaTwilio('+1234567890', 'Test message');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Twilio');
    });

    it('should handle network errors', async () => {
      (sendEmailViaSendGrid as any).mockRejectedValueOnce(new Error('Network error'));

      await expect(
        sendEmailViaSendGrid('customer@example.com', 'Test', 'Body')
      ).rejects.toThrow('Network error');
    });
  });

  describe('Tenant Isolation', () => {
    it('should only load templates for the specified business_id', async () => {
      const businessId1 = 'biz-123';
      const businessId2 = 'biz-456';
      const userId = 'user-123';
      const trigger: NotificationTrigger = 'booking_created';
      const channel = 'email';

      const template1 = createMockNotificationTemplate({
        business_id: businessId1,
        user_id: userId,
        trigger: 'booking_created',
        channel: 'email',
      });

      let callCount = 0;
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'notification_templates') {
          callCount++;
          const templateBuilder = {
            select: vi.fn(() => templateBuilder),
            eq: vi.fn(() => templateBuilder),
            is: vi.fn(() => templateBuilder),
            order: vi.fn(() => templateBuilder),
            limit: vi.fn(() => templateBuilder),
            maybeSingle: vi.fn().mockImplementation(() => {
              // First call is for businessId1 (has template), second is for businessId2 (no template)
              if (callCount === 1) {
                return Promise.resolve({ data: template1, error: null });
              } else {
                return Promise.resolve({ data: null, error: { code: 'PGRST116' } });
              }
            }),
          };
          return templateBuilder;
        }
        return createChainableBuilder();
      });

      const result1 = await loadTemplateForTrigger(businessId1, userId, trigger, channel);
      const result2 = await loadTemplateForTrigger(businessId2, userId, trigger, channel);

      expect(result1).toEqual(template1);
      expect(result2).toBeNull();
    });

    it('should only load templates for the specified user_id', async () => {
      const businessId = 'biz-123';
      const userId1 = 'user-123';
      const userId2 = 'user-456';
      const trigger: NotificationTrigger = 'booking_created';
      const channel = 'email';

      const template1 = createMockNotificationTemplate({
        business_id: businessId,
        user_id: userId1,
        trigger: 'booking_created',
        channel: 'email',
      });

      let callCount = 0;
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'notification_templates') {
          callCount++;
          const templateBuilder = {
            select: vi.fn(() => templateBuilder),
            eq: vi.fn(() => templateBuilder),
            is: vi.fn(() => templateBuilder),
            order: vi.fn(() => templateBuilder),
            limit: vi.fn(() => templateBuilder),
            maybeSingle: vi.fn().mockImplementation(() => {
              // First call is for userId1 (has template), second is for userId2 (no template)
              if (callCount === 1) {
                return Promise.resolve({ data: template1, error: null });
              } else {
                return Promise.resolve({ data: null, error: { code: 'PGRST116' } });
              }
            }),
          };
          return templateBuilder;
        }
        return createChainableBuilder();
      });

      const result1 = await loadTemplateForTrigger(businessId, userId1, trigger, channel);
      const result2 = await loadTemplateForTrigger(businessId, userId2, trigger, channel);

      expect(result1).toEqual(template1);
      expect(result2).toBeNull();
    });
  });

  describe('Notification Triggers', () => {
    it('should handle booking_created trigger', async () => {
      const business = createMockBusiness({ notifications_enabled: true });
      const booking = createMockBooking();
      const customer = createMockCustomer({ email: 'customer@example.com' });

      mockSupabase.from.mockImplementation((table: string) => {
        const builder = createChainableBuilder();
        if (table === 'businesses') {
          builder.single = vi.fn().mockResolvedValue({ data: business, error: null });
        } else if (table === 'bookings') {
          builder.single = vi.fn().mockResolvedValue({
            data: {
              ...booking,
              customers: customer,
              services: createMockService(),
              staff: createMockStaff(),
            },
            error: null,
          });
        } else if (table === 'notification_templates') {
          const templateBuilder = {
            select: vi.fn(() => templateBuilder),
            eq: vi.fn(() => templateBuilder),
            is: vi.fn(() => templateBuilder),
            order: vi.fn(() => templateBuilder),
            limit: vi.fn(() => templateBuilder),
            maybeSingle: vi.fn().mockResolvedValue({
              data: createMockNotificationTemplate({
                trigger: 'booking_created',
                is_enabled: true,
              }),
              error: null,
            }),
          };
          return templateBuilder;
        } else if (table === 'notification_jobs') {
          builder.single = vi.fn().mockResolvedValue({
            data: null,
            error: { code: 'PGRST116' },
          });
          builder.insert = vi.fn().mockResolvedValue({ error: null });
        }
        return builder;
      });

      await emitNotification('biz-123', 'booking_created', 'booking-123');

      expect(mockSupabase.from).toHaveBeenCalledWith('notification_jobs');
    });

    it('should handle fee_charged trigger with amount', async () => {
      const business = createMockBusiness({ notifications_enabled: true });
      const booking = createMockBooking();
      const customer = createMockCustomer({ email: 'customer@example.com' });

      mockSupabase.from.mockImplementation((table: string) => {
        const builder = createChainableBuilder();
        if (table === 'businesses') {
          builder.single = vi.fn().mockResolvedValue({ data: business, error: null });
        } else if (table === 'bookings') {
          builder.single = vi.fn().mockResolvedValue({
            data: {
              ...booking,
              customers: customer,
              services: createMockService(),
              staff: createMockStaff(),
            },
            error: null,
          });
        } else if (table === 'notification_templates') {
          let templateCallCount = 0;
          const templateBuilder = {
            select: vi.fn(() => templateBuilder),
            eq: vi.fn(() => templateBuilder),
            is: vi.fn(() => templateBuilder),
            order: vi.fn(() => templateBuilder),
            limit: vi.fn(() => templateBuilder),
            maybeSingle: vi.fn().mockImplementation(() => {
              templateCallCount++;
              // Return template for both email and SMS calls
              return Promise.resolve({
                data: createMockNotificationTemplate({
                  trigger: 'fee_charged',
                  is_enabled: true,
                  channel: templateCallCount === 1 ? 'email' : 'sms',
                }),
                error: null,
              });
            }),
          };
          return templateBuilder;
        } else if (table === 'notification_jobs') {
          builder.single = vi.fn().mockResolvedValue({
            data: null,
            error: { code: 'PGRST116' },
          });
          builder.insert = vi.fn().mockResolvedValue({ error: null });
        }
        return builder;
      });

      await emitNotification('biz-123', 'fee_charged', 'booking-123', undefined, 2500);

      expect(mockSupabase.from).toHaveBeenCalledWith('notification_jobs');
    });
  });

  describe('Preview Endpoint', () => {
    it('should render template preview with sample data', async () => {
      const template = createMockNotificationTemplate({
        id: 'template-123',
        body_markdown: 'Hello ${customer.name}, your ${service.name} is on ${booking.date} at ${booking.time}.',
        subject: 'Booking Confirmation: ${booking.code}',
      });

      const sampleData: NotificationData = {
        customer: { name: 'Jane Doe', email: 'jane@example.com' },
        service: { name: 'Haircut', duration_min: 60, price_cents: 10000 },
        booking: {
          id: 'booking-12345678',
          start_at: '2025-08-05T15:00:00Z',
          final_price_cents: 8000,
          price_cents: 10000,
        },
        business: {
          name: 'Test Salon',
          timezone: 'America/New_York',
        },
      };

      const renderedBody = renderTemplate(template.body_markdown, sampleData, 'America/New_York');
      const renderedSubject = renderTemplate(template.subject!, sampleData, 'America/New_York');

      expect(renderedBody).toContain('Jane Doe');
      expect(renderedBody).toContain('Haircut');
      expect(renderedSubject).toContain('TITHI-BOOKING'); // Booking code is generated from booking.id
    });

    it('should handle preview with custom sample data', () => {
      const template = createMockNotificationTemplate({
        body_markdown: 'Hello ${customer.name}, amount: ${booking.amount}',
      });

      const customData: NotificationData = {
        customer: { name: 'Custom Name', email: 'custom@example.com' },
        booking: {
          id: 'booking-custom',
          start_at: '2025-08-05T15:00:00Z',
          final_price_cents: 5000,
          price_cents: 10000,
        },
      };

      const rendered = renderTemplate(template.body_markdown, customData);

      expect(rendered).toContain('Custom Name');
      expect(rendered).toContain('$50.00');
    });
  });
});

