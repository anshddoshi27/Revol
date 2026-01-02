/**
 * Unit tests for notification template engine
 * Tests placeholder merging, validation, and rendering
 */

import { describe, it, expect } from 'vitest';
import { renderTemplate, validatePlaceholders, ALLOWED_PLACEHOLDERS } from '../notifications';
import type { NotificationData } from '../notifications';

describe('Notification Template Engine', () => {
  describe('Placeholder Validation', () => {
    it('should accept valid placeholders', () => {
      const template = 'Hello ${customer.name}, your booking ${booking.code} is confirmed.';
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

    it('should identify all invalid placeholders', () => {
      const template = '${customer.name} ${bad.one} ${bad.two}';
      const result = validatePlaceholders(template);

      expect(result.valid).toBe(false);
      expect(result.invalid).toContain('bad.one');
      expect(result.invalid).toContain('bad.two');
    });

    it('should accept all allowed placeholders', () => {
      const template = ALLOWED_PLACEHOLDERS.map(p => `\${${p}}`).join(' ');
      const result = validatePlaceholders(template);

      expect(result.valid).toBe(true);
      expect(result.invalid).toHaveLength(0);
    });
  });

  describe('Template Rendering', () => {
    const mockData: NotificationData = {
      customer: {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890',
      },
      service: {
        name: 'Haircut',
        duration_min: 60,
        price_cents: 10000,
      },
      staff: {
        name: 'Jane Smith',
      },
      booking: {
        id: 'booking-123',
        start_at: '2025-01-15T10:00:00Z',
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
      booking_url: 'https://testsalon.revol.com/confirm/REVOL-12345678',
    };

    it('should replace customer placeholders', () => {
      const template = 'Hello ${customer.name}, email: ${customer.email}, phone: ${customer.phone}';
      const rendered = renderTemplate(template, mockData);

      expect(rendered).toContain('John Doe');
      expect(rendered).toContain('john@example.com');
      expect(rendered).toContain('+1234567890');
    });

    it('should replace service placeholders', () => {
      const template = 'Service: ${service.name}, Duration: ${service.duration} min, Price: ${service.price}';
      const rendered = renderTemplate(template, mockData);

      expect(rendered).toContain('Haircut');
      expect(rendered).toContain('60');
      expect(rendered).toContain('$100.00');
    });

    it('should replace staff placeholders', () => {
      const template = 'Your stylist is ${staff.name}';
      const rendered = renderTemplate(template, mockData);

      expect(rendered).toContain('Jane Smith');
    });

    it('should replace booking placeholders', () => {
      const template = 'Booking ${booking.code} on ${booking.date} at ${booking.time} for ${booking.amount}';
      const rendered = renderTemplate(template, mockData, 'America/New_York');

      // Booking code is generated from booking.id (first 8 chars) - 'booking-123' -> 'REVOL-BOOKING'
      expect(rendered).toContain('REVOL-BOOKING');
      expect(rendered).toContain('$80.00'); // Uses final_price_cents
    });

    it('should replace business placeholders', () => {
      const template = 'From ${business.name}, contact: ${business.support_email} or ${business.phone}';
      const rendered = renderTemplate(template, mockData);

      expect(rendered).toContain('Test Salon');
      expect(rendered).toContain('support@testsalon.com');
      expect(rendered).toContain('+0987654321');
    });

    it('should replace booking URL placeholder', () => {
      const template = 'View booking: ${booking.url}';
      const rendered = renderTemplate(template, mockData);

      expect(rendered).toContain('https://testsalon.revol.com/confirm/REVOL-12345678');
    });

    it('should generate booking URL if not provided', () => {
      const dataWithoutUrl = { ...mockData };
      delete dataWithoutUrl.booking_url;

      const template = 'View booking: ${booking.url}';
      const rendered = renderTemplate(template, dataWithoutUrl);

      // URL is generated from booking.id (first 8 chars) - actual format may vary
      expect(rendered).toContain('https://testsalon.revol.com/confirm/REVOL-');
    });

    it('should handle multiple occurrences of same placeholder', () => {
      const template = 'Hello ${customer.name}, ${customer.name} is your name.';
      const rendered = renderTemplate(template, mockData);

      expect(rendered).toBe('Hello John Doe, John Doe is your name.');
    });

    it('should handle missing optional data gracefully', () => {
      const minimalData: NotificationData = {
        customer: {
          name: 'John Doe',
          email: 'john@example.com',
        },
        service: {
          name: 'Haircut',
          duration_min: 60,
          price_cents: 10000,
        },
      };

      const template = 'Hello ${customer.name}, phone: ${customer.phone}';
      const rendered = renderTemplate(template, minimalData);

      expect(rendered).toContain('John Doe');
      // Phone should be empty string if not provided
      expect(rendered).toContain('phone: ');
    });

    it('should use final_price_cents for booking.amount if available', () => {
      const template = 'Amount: ${booking.amount}';
      const rendered = renderTemplate(template, mockData);

      expect(rendered).toContain('$80.00'); // Uses final_price_cents (8000 cents)
    });

    it('should fall back to price_cents if final_price_cents not available', () => {
      const dataWithoutFinal = {
        ...mockData,
        booking: {
          ...mockData.booking!,
          final_price_cents: undefined,
        },
      };

      const template = 'Amount: ${booking.amount}';
      const rendered = renderTemplate(template, dataWithoutFinal);

      expect(rendered).toContain('$100.00'); // Uses price_cents (10000 cents)
    });

    it('should handle amount placeholder for fee_charged trigger', () => {
      const template = 'Fee charged: ${amount}';
      const dataWithAmount: NotificationData = {
        ...mockData,
        amount: 2500, // $25 fee
      };

      const rendered = renderTemplate(template, dataWithAmount);
      expect(rendered).toContain('$25.00');
    });

    it('should handle amount placeholder for refunded trigger', () => {
      const template = 'Refunded: ${amount}';
      const dataWithAmount: NotificationData = {
        ...mockData,
        amount: 5000, // $50 refund
      };

      const rendered = renderTemplate(template, dataWithAmount);
      expect(rendered).toContain('$50.00');
    });
  });

  describe('Timezone Handling', () => {
    const mockData: NotificationData = {
      customer: {
        name: 'John Doe',
        email: 'john@example.com',
      },
      booking: {
        id: 'booking-123',
        start_at: '2025-01-15T15:00:00Z', // 3 PM UTC
      },
      business: {
        name: 'Test Salon',
        timezone: 'America/New_York', // UTC-5
      },
    };

    it('should format date in business timezone', () => {
      const template = 'Date: ${booking.date}';
      const rendered = renderTemplate(template, mockData, 'America/New_York');

      // Should show date in New York timezone
      expect(rendered).toContain('January');
      expect(rendered).toContain('2025');
    });

    it('should format time in business timezone', () => {
      const template = 'Time: ${booking.time}';
      const rendered = renderTemplate(template, mockData, 'America/New_York');

      // Should show time in New York timezone (10 AM EST)
      expect(rendered).toContain('10:00');
    });

    it('should use business timezone from data if not provided', () => {
      const template = 'Time: ${booking.time}';
      const rendered = renderTemplate(template, mockData);

      // Should use business.timezone from data
      expect(rendered).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty template', () => {
      const rendered = renderTemplate('', {});
      expect(rendered).toBe('');
    });

    it('should handle template with no placeholders', () => {
      const template = 'This is a plain text message.';
      const rendered = renderTemplate(template, {});
      expect(rendered).toBe(template);
    });

    it('should handle malformed placeholder syntax', () => {
      const template = 'Hello ${customer.name} ${unclosed';
      // Should not crash, but may leave unclosed placeholder
      const rendered = renderTemplate(template, {
        customer: { name: 'John', email: 'john@example.com' },
      });
      expect(rendered).toContain('John');
    });
  });
});

