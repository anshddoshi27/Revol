/**
 * useNotificationTemplates Hook Tests
 */

import { renderHook, act } from '@testing-library/react';
import { useNotificationTemplates } from '../useNotificationTemplates';
import type { NotificationTemplate, NotificationTemplateFormData } from '../../api/types/notifications';

// Mock the notifications service
jest.mock('../../api/services/notifications', () => ({
  notificationsService: {
    getTemplates: jest.fn(),
    createTemplate: jest.fn(),
    updateTemplate: jest.fn(),
    deleteTemplate: jest.fn(),
    getTemplate: jest.fn(),
    previewTemplate: jest.fn(),
    sendTestNotification: jest.fn(),
    getQuietHours: jest.fn(),
    updateQuietHours: jest.fn(),
  },
  notificationsUtils: {
    validateTemplate: jest.fn(),
    checkTemplateLimit: jest.fn(),
  },
}));

import { notificationsService, notificationsUtils } from '../../api/services/notifications';

const mockNotificationsService = notificationsService as jest.Mocked<typeof notificationsService>;
const mockNotificationsUtils = notificationsUtils as jest.Mocked<typeof notificationsUtils>;

describe('useNotificationTemplates', () => {
  const sampleTemplate: NotificationTemplate = {
    id: 'template-1',
    tenant_id: 'tenant-1',
    name: 'Booking Confirmation',
    channel: 'email',
    subject: 'Your booking is confirmed!',
    content: 'Hello {customer_name}, your booking for {service_name} is confirmed.',
    variables: {},
    required_variables: ['customer_name', 'service_name'],
    trigger_event: 'booking_created',
    category: 'confirmation',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    mockNotificationsService.getTemplates.mockResolvedValue([sampleTemplate]);
    mockNotificationsService.createTemplate.mockResolvedValue(sampleTemplate);
    mockNotificationsService.updateTemplate.mockResolvedValue(sampleTemplate);
    mockNotificationsService.deleteTemplate.mockResolvedValue(undefined);
    mockNotificationsService.getTemplate.mockResolvedValue(sampleTemplate);
    mockNotificationsService.previewTemplate.mockResolvedValue({
      rendered_content: 'Hello John Doe, your booking for Haircut is confirmed.',
      rendered_subject: 'Your booking is confirmed!',
      preview_sent: false,
    });
    mockNotificationsService.sendTestNotification.mockResolvedValue({
      success: true,
      message: 'Test notification sent successfully',
    });
    mockNotificationsService.getQuietHours.mockResolvedValue({
      enabled: false,
      start_time: '22:00',
      end_time: '08:00',
      timezone: 'America/New_York',
    });
    mockNotificationsService.updateQuietHours.mockResolvedValue({
      enabled: false,
      start_time: '22:00',
      end_time: '08:00',
      timezone: 'America/New_York',
    });

    mockNotificationsUtils.validateTemplate.mockReturnValue({
      isValid: true,
      errors: [],
    });
    mockNotificationsUtils.checkTemplateLimit.mockReturnValue({
      canAdd: true,
    });
  });

  it('initializes with empty templates', () => {
    const { result } = renderHook(() => useNotificationTemplates());
    
    expect(result.current.templates).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isSubmitting).toBe(false);
  });

  it('loads templates on mount', async () => {
    const { result } = renderHook(() => useNotificationTemplates());
    
    await act(async () => {
      await result.current.refreshTemplates();
    });
    
    expect(mockNotificationsService.getTemplates).toHaveBeenCalled();
    expect(result.current.templates).toEqual([sampleTemplate]);
  });

  it('creates a new template', async () => {
    const { result } = renderHook(() => useNotificationTemplates());
    
    const templateData: NotificationTemplateFormData = {
      name: 'New Template',
      channel: 'email',
      subject: 'New Subject',
      content: 'New content',
      required_variables: ['customer_name'],
      trigger_event: 'booking_created',
      category: 'confirmation',
      is_active: true,
    };

    let createdTemplate: NotificationTemplate | null = null;
    
    await act(async () => {
      createdTemplate = await result.current.createTemplate(templateData);
    });
    
    expect(mockNotificationsService.createTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'New Template',
        channel: 'email',
        content: 'New content',
      })
    );
    expect(createdTemplate).toEqual(sampleTemplate);
  });

  it('updates an existing template', async () => {
    const { result } = renderHook(() => useNotificationTemplates({
      initialTemplates: [sampleTemplate],
    }));
    
    const templateData: NotificationTemplateFormData = {
      name: 'Updated Template',
      channel: 'email',
      subject: 'Updated Subject',
      content: 'Updated content',
      required_variables: ['customer_name'],
      trigger_event: 'booking_created',
      category: 'confirmation',
      is_active: true,
    };

    let updatedTemplate: NotificationTemplate | null = null;
    
    await act(async () => {
      updatedTemplate = await result.current.updateTemplate('template-1', templateData);
    });
    
    expect(mockNotificationsService.updateTemplate).toHaveBeenCalledWith(
      'template-1',
      expect.objectContaining({
        name: 'Updated Template',
        content: 'Updated content',
      })
    );
    expect(updatedTemplate).toEqual(sampleTemplate);
  });

  it('deletes a template', async () => {
    const { result } = renderHook(() => useNotificationTemplates({
      initialTemplates: [sampleTemplate],
    }));
    
    let deleted: boolean = false;
    
    await act(async () => {
      deleted = await result.current.deleteTemplate('template-1');
    });
    
    expect(mockNotificationsService.deleteTemplate).toHaveBeenCalledWith('template-1');
    expect(deleted).toBe(true);
  });

  it('validates template data', () => {
    const { result } = renderHook(() => useNotificationTemplates());
    
    const templateData: NotificationTemplateFormData = {
      name: 'Test Template',
      channel: 'email',
      subject: 'Test Subject',
      content: 'Test content',
      required_variables: ['customer_name'],
      trigger_event: 'booking_created',
      category: 'confirmation',
      is_active: true,
    };

    const validation = result.current.validateTemplate(templateData);
    
    expect(mockNotificationsUtils.validateTemplate).toHaveBeenCalledWith(templateData);
    expect(validation).toEqual({ isValid: true, errors: [] });
  });

  it('checks template limits', () => {
    const { result } = renderHook(() => useNotificationTemplates({
      initialTemplates: [sampleTemplate],
    }));
    
    const limitCheck = result.current.checkTemplateLimit('confirmation');
    
    expect(mockNotificationsUtils.checkTemplateLimit).toHaveBeenCalledWith(
      [sampleTemplate],
      'confirmation'
    );
    expect(limitCheck).toEqual({ canAdd: true });
  });

  it('handles errors gracefully', async () => {
    const error = new Error('API Error');
    mockNotificationsService.createTemplate.mockRejectedValue(error);
    
    const onError = jest.fn();
    const { result } = renderHook(() => useNotificationTemplates({ onError }));
    
    const templateData: NotificationTemplateFormData = {
      name: 'Test Template',
      channel: 'email',
      subject: 'Test Subject',
      content: 'Test content',
      required_variables: ['customer_name'],
      trigger_event: 'booking_created',
      category: 'confirmation',
      is_active: true,
    };

    let createdTemplate: NotificationTemplate | null = null;
    
    await act(async () => {
      createdTemplate = await result.current.createTemplate(templateData);
    });
    
    expect(createdTemplate).toBeNull();
    expect(result.current.errors.general).toBe('API Error');
    expect(onError).toHaveBeenCalledWith(error);
  });

  it('computes template statistics correctly', () => {
    const templates = [
      { ...sampleTemplate, category: 'confirmation' },
      { ...sampleTemplate, id: 'template-2', category: 'reminder' },
      { ...sampleTemplate, id: 'template-3', category: 'reminder' },
    ];
    
    const { result } = renderHook(() => useNotificationTemplates({
      initialTemplates: templates,
    }));
    
    expect(result.current.totalTemplates).toBe(3);
    expect(result.current.canAddConfirmation).toBe(true);
    expect(result.current.canAddReminder).toBe(false); // Already at limit of 2
  });
});
