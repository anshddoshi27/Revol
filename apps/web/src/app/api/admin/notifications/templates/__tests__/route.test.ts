import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '../route';
import { validatePlaceholders } from '@/lib/notifications';

// Mock dependencies
vi.mock('@/lib/db', () => ({
  createServerClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          is: vi.fn(() => ({
            order: vi.fn(() => ({
              data: [],
              error: null,
            })),
          })),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({
            data: { id: 'template-123', name: 'Test Template' },
            error: null,
          })),
        })),
      })),
    })),
  })),
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUserId: vi.fn(() => Promise.resolve('user-123')),
  getCurrentBusinessId: vi.fn(() => Promise.resolve('business-123')),
}));

describe('Notification Templates API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/admin/notifications/templates', () => {
    it('should return templates list with allowed placeholders', async () => {
      const request = new Request('http://localhost/api/admin/notifications/templates');
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('templates');
      expect(data).toHaveProperty('allowed_placeholders');
      expect(Array.isArray(data.allowed_placeholders)).toBe(true);
    });

    it('should return 401 if unauthorized', async () => {
      vi.mocked(require('@/lib/auth').getCurrentUserId).mockResolvedValueOnce(null);

      const response = await GET();
      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/admin/notifications/templates', () => {
    it('should create a valid email template', async () => {
      const body = {
        name: 'Booking Confirmation',
        channel: 'email',
        category: 'confirmation',
        trigger: 'booking_created',
        subject: 'Your booking with ${business.name}',
        body: 'Hello ${customer.name}, your booking ${booking.code} is confirmed.',
        is_enabled: true,
      };

      const request = new Request('http://localhost/api/admin/notifications/templates', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toHaveProperty('template');
      expect(data.template.name).toBe('Booking Confirmation');
    });

    it('should reject template with invalid placeholders', async () => {
      const body = {
        name: 'Invalid Template',
        channel: 'email',
        category: 'confirmation',
        trigger: 'booking_created',
        subject: 'Test',
        body: 'Hello ${customer.name} and ${invalid.placeholder}',
        is_enabled: true,
      };

      const request = new Request('http://localhost/api/admin/notifications/templates', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
      expect(data).toHaveProperty('invalid_placeholders');
      expect(data.invalid_placeholders).toContain('invalid.placeholder');
    });

    it('should require subject for email templates', async () => {
      const body = {
        name: 'No Subject Template',
        channel: 'email',
        category: 'confirmation',
        trigger: 'booking_created',
        body: 'Hello ${customer.name}',
        is_enabled: true,
      };

      const request = new Request('http://localhost/api/admin/notifications/templates', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('subject is required');
    });

    it('should validate trigger enum', async () => {
      const body = {
        name: 'Invalid Trigger',
        channel: 'email',
        category: 'confirmation',
        trigger: 'invalid_trigger',
        subject: 'Test',
        body: 'Hello ${customer.name}',
        is_enabled: true,
      };

      const request = new Request('http://localhost/api/admin/notifications/templates', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid trigger');
    });
  });
});



