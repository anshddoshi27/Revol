/**
 * Production-ready tests for notification system
 * Tests template rendering, placeholder resolution, and job enqueueing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  renderTemplate,
  validatePlaceholders,
  enqueueNotification,
  emitNotification,
  ALLOWED_PLACEHOLDERS,
} from '../notifications';
import { createAdminClient } from '../db';

vi.mock('../db', () => ({
  createAdminClient: vi.fn(),
}));

describe('Notification System - Production Tests', () => {
  const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
    single: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (createAdminClient as any).mockReturnValue(mockSupabase);
  });

  describe('validatePlaceholders', () => {
    it('should validate allowed placeholders', () => {
      const template = 'Hi ${customer.name}, your ${service.name} is confirmed for ${booking.date} at ${booking.time}';
      const result = validatePlaceholders(template);
      expect(result.valid).toBe(true);
      expect(result.invalid).toEqual([]);
    });

    it('should reject invalid placeholders', () => {
      const template = 'Hi ${customer.name}, your ${invalid.placeholder} is here';
      const result = validatePlaceholders(template);
      expect(result.valid).toBe(false);
      expect(result.invalid).toContain('invalid.placeholder');
    });

    it('should handle templates with no placeholders', () => {
      const template = 'This is a plain text template';
      const result = validatePlaceholders(template);
      expect(result.valid).toBe(true);
      expect(result.invalid).toEqual([]);
    });
  });

  describe('renderTemplate', () => {
    const mockData = {
      customer: {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890',
      },
      service: {
        name: 'Haircut',
        duration_min: 30,
        price_cents: 5000,
      },
      staff: {
        name: 'Jane Smith',
      },
      booking: {
        id: 'booking-123',
        start_at: '2025-01-20T14:00:00Z',
        final_price_cents: 5000,
      },
      business: {
        name: 'Demo Salon',
        support_email: 'support@demo.com',
        phone: '+1987654321',
        subdomain: 'demo',
        timezone: 'America/New_York',
      },
    };

    it('should render all customer placeholders', () => {
      const template = 'Hi ${customer.name}, email: ${customer.email}, phone: ${customer.phone}';
      const rendered = renderTemplate(template, mockData);
      expect(rendered).toContain('John Doe');
      expect(rendered).toContain('john@example.com');
      expect(rendered).toContain('+1234567890');
    });

    it('should render service placeholders', () => {
      const template = 'Service: ${service.name}, Duration: ${service.duration} minutes, Price: ${service.price}';
      const rendered = renderTemplate(template, mockData);
      expect(rendered).toContain('Haircut');
      expect(rendered).toContain('30');
      expect(rendered).toContain('$50.00');
    });

    it('should render staff placeholder', () => {
      const template = 'Your stylist: ${staff.name}';
      const rendered = renderTemplate(template, mockData);
      expect(rendered).toContain('Jane Smith');
    });

    it('should render booking placeholders with timezone conversion', () => {
      const template = 'Date: ${booking.date}, Time: ${booking.time}, Code: ${booking.code}, Amount: ${booking.amount}';
      const rendered = renderTemplate(template, mockData, 'America/New_York');
      expect(rendered).toContain('REVOL-BOOKING1');
      expect(rendered).toContain('$50.00');
      // Date and time should be formatted (exact format depends on formatInTimeZone implementation)
      expect(rendered).not.toContain('${booking.date}');
      expect(rendered).not.toContain('${booking.time}');
    });

    it('should render business placeholders', () => {
      const template = 'Business: ${business.name}, Support: ${business.support_email}, Phone: ${business.phone}';
      const rendered = renderTemplate(template, mockData);
      expect(rendered).toContain('Demo Salon');
      expect(rendered).toContain('support@demo.com');
      expect(rendered).toContain('+1987654321');
    });

    it('should render booking URL placeholder', () => {
      const template = 'View booking: ${booking.url}';
      const rendered = renderTemplate(template, mockData);
      expect(rendered).toContain('https://demo.revol.com/confirm/REVOL-BOOKING1');
    });

    it('should handle missing data gracefully', () => {
      const template = 'Hi ${customer.name}, service: ${service.name}';
      const rendered = renderTemplate(template, {
        customer: { name: 'John' },
        // service missing
      });
      expect(rendered).toContain('John');
      expect(rendered).toContain('${service.name}'); // Unresolved placeholder remains
    });

    it('should handle amount placeholder for fee_charged', () => {
      const template = 'Fee charged: ${amount}';
      const rendered = renderTemplate(template, {
        amount: 2500, // $25.00
      });
      expect(rendered).toContain('$25.00');
    });
  });

  describe('enqueueNotification', () => {
    it('should enqueue notification job', async () => {
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: null, // No existing job
        error: null,
      });

      mockSupabase.insert.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      await enqueueNotification({
        businessId: 'business-1',
        userId: 'user-1',
        bookingId: 'booking-1',
        trigger: 'booking_created',
        recipientEmail: 'customer@example.com',
        templateId: 'template-1',
        subject: 'Booking Confirmed',
        body: 'Your booking is confirmed',
        channel: 'email',
      });

      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          business_id: 'business-1',
          user_id: 'user-1',
          booking_id: 'booking-1',
          trigger: 'booking_created',
          recipient_email: 'customer@example.com',
          subject: 'Booking Confirmed',
          body: 'Your booking is confirmed',
          channel: 'email',
          status: 'pending',
          attempt_count: 0,
        })
      );
    });

    it('should skip enqueueing if job already exists (idempotency)', async () => {
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: { id: 'existing-job' }, // Job already exists
        error: null,
      });

      await enqueueNotification({
        businessId: 'business-1',
        userId: 'user-1',
        bookingId: 'booking-1',
        trigger: 'booking_created',
        recipientEmail: 'customer@example.com',
        body: 'Your booking is confirmed',
        channel: 'email',
      });

      expect(mockSupabase.insert).not.toHaveBeenCalled();
    });

    it('should handle unique constraint violation gracefully', async () => {
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      mockSupabase.insert.mockResolvedValueOnce({
        data: null,
        error: {
          code: '23505', // Unique constraint violation
          message: 'Duplicate key',
        },
      });

      // Should not throw
      await expect(
        enqueueNotification({
          businessId: 'business-1',
          userId: 'user-1',
          bookingId: 'booking-1',
          trigger: 'booking_created',
          recipientEmail: 'customer@example.com',
          body: 'Your booking is confirmed',
          channel: 'email',
        })
      ).resolves.not.toThrow();
    });
  });

  describe('emitNotification - Integration', () => {
    it('should load booking data and enqueue notifications', async () => {
      const business = {
        id: 'business-1',
        user_id: 'user-1',
        name: 'Demo Salon',
        support_email: 'support@demo.com',
        phone: '+1987654321',
        subdomain: 'demo',
        timezone: 'America/New_York',
        notifications_enabled: true,
      };

      const booking = {
        id: 'booking-1',
        business_id: 'business-1',
        start_at: '2025-01-20T14:00:00Z',
        end_at: '2025-01-20T14:30:00Z',
        final_price_cents: 5000,
        price_cents: 5000,
        staff_id: 'staff-1',
        status: 'pending',
        customers: {
          id: 'customer-1',
          name: 'John Doe',
          email: 'john@example.com',
          phone: '+1234567890',
        },
        services: {
          id: 'service-1',
          name: 'Haircut',
          duration_min: 30,
          price_cents: 5000,
        },
        staff: {
          id: 'staff-1',
          name: 'Jane Smith',
        },
      };

      const emailTemplate = {
        id: 'template-1',
        body_markdown: 'Hi ${customer.name}, your ${service.name} is confirmed',
        subject: 'Booking Confirmed',
      };

      // Mock business lookup
      mockSupabase.single.mockResolvedValueOnce({
        data: business,
        error: null,
      });

      // Mock booking lookup
      mockSupabase.single.mockResolvedValueOnce({
        data: booking,
        error: null,
      });

      // Mock template lookups
      mockSupabase.maybeSingle
        .mockResolvedValueOnce({
          data: emailTemplate,
          error: null,
        })
        .mockResolvedValueOnce({
          data: null, // No SMS template
          error: null,
        });

      // Mock enqueue checks (no existing jobs)
      mockSupabase.maybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      // Mock insert
      mockSupabase.insert.mockResolvedValue({
        data: null,
        error: null,
      });

      await emitNotification('business-1', 'booking_created', 'booking-1', mockSupabase);

      // Verify template was loaded
      expect(mockSupabase.from).toHaveBeenCalledWith('notification_templates');
      
      // Verify notification was enqueued
      expect(mockSupabase.insert).toHaveBeenCalled();
    });

    it('should skip if notifications are disabled', async () => {
      const business = {
        id: 'business-1',
        user_id: 'user-1',
        notifications_enabled: false,
      };

      mockSupabase.single.mockResolvedValueOnce({
        data: business,
        error: null,
      });

      await emitNotification('business-1', 'booking_created', 'booking-1', mockSupabase);

      // Should not load booking or templates
      expect(mockSupabase.from).not.toHaveBeenCalledWith('bookings');
    });
  });
});



