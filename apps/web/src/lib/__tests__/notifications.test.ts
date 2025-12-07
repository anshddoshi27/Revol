import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderTemplate, validatePlaceholders, ALLOWED_PLACEHOLDERS } from '../notifications';
import type { NotificationData } from '../notifications';

describe('Notification Template Rendering', () => {
  const mockData: NotificationData = {
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
      id: 'abc123def456',
      start_at: '2025-01-20T14:00:00Z',
      final_price_cents: 5000,
      price_cents: 5000,
    },
    business: {
      name: 'Test Salon',
      support_email: 'support@testsalon.com',
      phone: '+1987654321',
      subdomain: 'testsalon',
      timezone: 'America/New_York',
    },
    booking_url: 'https://testsalon.tithi.com/confirm/TITHI-ABC123DE',
  };

  it('should replace customer placeholders', () => {
    const template = 'Hello ${customer.name}, your email is ${customer.email}';
    const result = renderTemplate(template, mockData, 'America/New_York');
    expect(result).toBe('Hello John Doe, your email is john@example.com');
  });

  it('should replace service placeholders', () => {
    const template = 'Service: ${service.name}, Duration: ${service.duration} min, Price: ${service.price}';
    const result = renderTemplate(template, mockData, 'America/New_York');
    expect(result).toBe('Service: Haircut, Duration: 30 min, Price: $50.00');
  });

  it('should replace staff placeholders', () => {
    const template = 'Your stylist is ${staff.name}';
    const result = renderTemplate(template, mockData, 'America/New_York');
    expect(result).toBe('Your stylist is Jane Smith');
  });

  it('should replace booking placeholders', () => {
    const template = 'Booking ${booking.code} on ${booking.date} at ${booking.time}';
    const result = renderTemplate(template, mockData, 'America/New_York');
    expect(result).toContain('Booking TITHI-ABC123DE');
    expect(result).toContain('Monday, January 20, 2025');
    expect(result).toMatch(/\d{1,2}:\d{2}\s(AM|PM)/); // Time format
  });

  it('should replace business placeholders', () => {
    const template = 'Contact ${business.name} at ${business.phone} or ${business.support_email}';
    const result = renderTemplate(template, mockData, 'America/New_York');
    expect(result).toBe('Contact Test Salon at +1987654321 or support@testsalon.com');
  });

  it('should replace booking URL placeholder', () => {
    const template = 'View booking: ${booking.url}';
    const result = renderTemplate(template, mockData, 'America/New_York');
    expect(result).toBe('View booking: https://testsalon.tithi.com/confirm/TITHI-ABC123DE');
  });

  it('should replace booking amount placeholder', () => {
    const template = 'Total amount: ${booking.amount}';
    const result = renderTemplate(template, mockData, 'America/New_York');
    expect(result).toBe('Total amount: $50.00');
  });

  it('should handle missing data gracefully', () => {
    const template = 'Hello ${customer.name}, service: ${service.name}';
    const partialData: NotificationData = {
      customer: { name: 'John', email: 'john@example.com' },
    };
    const result = renderTemplate(template, partialData, 'America/New_York');
    // When data is missing, placeholder remains unchanged (this is correct behavior)
    expect(result).toContain('Hello John');
    expect(result).toContain('${service.name}'); // Placeholder not replaced when data missing
  });

  it('should generate booking URL if not provided', () => {
    const template = 'Booking URL: ${booking.url}';
    const dataWithoutUrl = { ...mockData };
    delete dataWithoutUrl.booking_url;
    const result = renderTemplate(template, dataWithoutUrl, 'America/New_York');
    expect(result).toContain('https://testsalon.tithi.com/confirm/TITHI-');
  });
});

describe('Placeholder Validation', () => {
  it('should validate allowed placeholders', () => {
    const template = 'Hello ${customer.name}, your booking is ${booking.code}';
    const result = validatePlaceholders(template);
    expect(result.valid).toBe(true);
    expect(result.invalid).toEqual([]);
  });

  it('should detect invalid placeholders', () => {
    const template = 'Hello ${customer.name}, ${invalid.placeholder}';
    const result = validatePlaceholders(template);
    expect(result.valid).toBe(false);
    expect(result.invalid).toContain('invalid.placeholder');
  });

  it('should detect multiple invalid placeholders', () => {
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
    expect(result.invalid).toEqual([]);
  });

  it('should handle empty template', () => {
    const result = validatePlaceholders('');
    expect(result.valid).toBe(true);
    expect(result.invalid).toEqual([]);
  });

  it('should handle template without placeholders', () => {
    const template = 'This is a plain text template without any placeholders.';
    const result = validatePlaceholders(template);
    expect(result.valid).toBe(true);
    expect(result.invalid).toEqual([]);
  });
});

describe('Template Rendering Edge Cases', () => {
  it('should handle timezone conversion correctly', () => {
    const data: NotificationData = {
      booking: {
        id: 'test123',
        start_at: '2025-01-20T14:00:00Z', // 2 PM UTC
      },
      business: {
        name: 'Test',
        timezone: 'America/Los_Angeles', // UTC-8
      },
    };
    const template = 'Time: ${booking.time}';
    const result = renderTemplate(template, data, 'America/Los_Angeles');
    // Should show 6 AM PST (14:00 UTC - 8 hours)
    expect(result).toContain('6:00 AM');
  });

  it('should format price correctly', () => {
    const data: NotificationData = {
      booking: {
        id: 'test123',
        start_at: '2025-01-20T14:00:00Z',
        final_price_cents: 12345,
      },
    };
    const template = 'Amount: ${booking.amount}';
    const result = renderTemplate(template, data, 'America/New_York');
    expect(result).toBe('Amount: $123.45');
  });

  it('should use final_price_cents over price_cents', () => {
    const data: NotificationData = {
      booking: {
        id: 'test123',
        start_at: '2025-01-20T14:00:00Z',
        final_price_cents: 4000,
        price_cents: 5000,
      },
    };
    const template = 'Amount: ${booking.amount}';
    const result = renderTemplate(template, data, 'America/New_York');
    expect(result).toBe('Amount: $40.00'); // Should use final_price_cents
  });
});

