/**
 * Comprehensive tests for notification template CRUD endpoints
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '../route';
import { PUT, DELETE } from '../[id]/route';
import { validatePlaceholders, ALLOWED_PLACEHOLDERS } from '@/lib/notifications';
import { createServerClient } from '@/lib/db';
import { getCurrentUserId, getCurrentBusinessId } from '@/lib/auth';

// Mock dependencies
vi.mock('@/lib/db', () => ({
  createServerClient: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUserId: vi.fn(),
  getCurrentBusinessId: vi.fn(),
}));

describe('Notification Templates API - Comprehensive', () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            is: vi.fn(() => ({
              order: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            })),
          })),
        })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: vi.fn(),
                })),
              })),
            })),
          })),
        })),
      })),
    };

    (createServerClient as any).mockResolvedValue(mockSupabase);
    (getCurrentUserId as any).mockResolvedValue('user-123');
    (getCurrentBusinessId as any).mockResolvedValue('business-123');
  });

  describe('GET /api/admin/notifications/templates', () => {
    it('should return templates with allowed placeholders', async () => {
      const templates = [
        {
          id: 'template-1',
          name: 'Booking Confirmation',
          channel: 'email',
          trigger: 'booking_created',
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            is: vi.fn(() => ({
              order: vi.fn().mockResolvedValue({
                data: templates,
                error: null,
              }),
            })),
          })),
        })),
      });

      const response = await GET();
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.templates).toEqual(templates);
      expect(json.allowed_placeholders).toEqual(ALLOWED_PLACEHOLDERS);
    });

    it('should return 401 if unauthorized', async () => {
      (getCurrentUserId as any).mockResolvedValueOnce(null);

      const response = await GET();
      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/admin/notifications/templates', () => {
    it('should create valid email template', async () => {
      const templateData = {
        name: 'Booking Confirmation',
        channel: 'email',
        category: 'confirmation',
        trigger: 'booking_created',
        subject: 'Your booking with ${business.name}',
        body: 'Hello ${customer.name}, your booking ${booking.code} is confirmed.',
        is_enabled: true,
      };

      const createdTemplate = {
        id: 'template-new',
        ...templateData,
      };

      mockSupabase.from.mockReturnValue({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: createdTemplate,
              error: null,
            }),
          })),
        })),
      });

      const request = new Request('http://localhost/api/admin/notifications/templates', {
        method: 'POST',
        body: JSON.stringify(templateData),
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(201);
      expect(json.template).toEqual(createdTemplate);
    });

    it('should reject template with invalid placeholders', async () => {
      const templateData = {
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
        body: JSON.stringify(templateData),
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toContain('Invalid placeholders');
      expect(json.invalid_placeholders).toContain('invalid.placeholder');
    });

    it('should require subject for email templates', async () => {
      const templateData = {
        name: 'No Subject',
        channel: 'email',
        category: 'confirmation',
        trigger: 'booking_created',
        body: 'Hello ${customer.name}',
        is_enabled: true,
      };

      const request = new Request('http://localhost/api/admin/notifications/templates', {
        method: 'POST',
        body: JSON.stringify(templateData),
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toContain('subject is required');
    });

    it('should validate trigger enum', async () => {
      const templateData = {
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
        body: JSON.stringify(templateData),
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toContain('Invalid trigger');
    });

    it('should validate all required fields', async () => {
      const incompleteData = {
        name: 'Incomplete',
        channel: 'email',
        // Missing category, trigger, body
      };

      const request = new Request('http://localhost/api/admin/notifications/templates', {
        method: 'POST',
        body: JSON.stringify(incompleteData),
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toContain('Missing required fields');
    });
  });

  describe('PUT /api/admin/notifications/templates/[id]', () => {
    it('should update existing template', async () => {
      const existingTemplate = {
        id: 'template-1',
        name: 'Old Name',
        channel: 'email',
        category: 'confirmation',
        trigger: 'booking_created',
        subject: 'Old Subject',
        body_markdown: 'Old body',
        is_enabled: true,
      };

      const updatedTemplate = {
        ...existingTemplate,
        name: 'New Name',
        body_markdown: 'New body with ${customer.name}',
      };

      // Mock fetch existing
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              is: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: existingTemplate,
                  error: null,
                }),
              })),
            })),
          })),
        })),
      });

      // Mock update
      mockSupabase.from.mockReturnValueOnce({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({
                    data: updatedTemplate,
                    error: null,
                  }),
                })),
              })),
            })),
          })),
        })),
      });

      const request = new Request('http://localhost/api/admin/notifications/templates/template-1', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'New Name',
          body: 'New body with ${customer.name}',
        }),
      });

      const response = await PUT(request, { params: { id: 'template-1' } });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.template.name).toBe('New Name');
    });

    it('should return 404 if template not found', async () => {
      mockSupabase.from.mockReturnValue({
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
      });

      const request = new Request('http://localhost/api/admin/notifications/templates/not-found', {
        method: 'PUT',
        body: JSON.stringify({ name: 'New Name' }),
      });

      const response = await PUT(request, { params: { id: 'not-found' } });
      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/admin/notifications/templates/[id]', () => {
    it('should soft delete template', async () => {
      const existingTemplate = {
        id: 'template-1',
        name: 'Test Template',
      };

      // Mock fetch existing
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              is: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: existingTemplate,
                  error: null,
                }),
              })),
            })),
          })),
        })),
      });

      // Mock soft delete
      mockSupabase.from.mockReturnValueOnce({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ error: null }),
            })),
          })),
        })),
      });

      const request = new Request('http://localhost/api/admin/notifications/templates/template-1', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: { id: 'template-1' } });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.message).toContain('deleted successfully');
    });
  });
});

