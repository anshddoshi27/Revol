/**
 * Notifications API Service
 * 
 * Service functions for notification-related API endpoints.
 * Handles notification template CRUD operations, previews, and quiet hours configuration.
 */

import { tithiApiClient } from '../client';
import type {
  NotificationTemplate,
  NotificationTemplateFormData,
  CreateNotificationTemplateRequest,
  UpdateNotificationTemplateRequest,
  NotificationTemplateResponse,
  NotificationTemplatesListResponse,
  PreviewNotificationRequest,
  PreviewNotificationResponse,
  PlaceholderData,
  QuietHoursConfig,
  UpdateQuietHoursRequest,
  UpdateQuietHoursResponse,
} from '../types/notifications';

/**
 * Notifications API service
 */
export const notificationsService = {
  /**
   * Get all notification templates for the current tenant
   */
  getTemplates: async (): Promise<NotificationTemplate[]> => {
    const client = tithiApiClient();
    const response = await client.get<NotificationTemplatesListResponse>('/notifications/templates');
    return response.templates.map(template => ({
      id: template.id,
      tenant_id: template.tenant_id,
      name: template.name,
      channel: template.channel,
      subject: template.subject,
      content: template.content,
      variables: template.variables,
      required_variables: template.required_variables,
      trigger_event: template.trigger_event,
      category: template.category,
      is_active: template.is_active,
      created_at: template.created_at,
      updated_at: template.updated_at,
    }));
  },

  /**
   * Get a specific notification template by ID
   */
  getTemplate: async (templateId: string): Promise<NotificationTemplate> => {
    const client = tithiApiClient();
    const response = await client.get<NotificationTemplateResponse>(`/notifications/templates/${templateId}`);
    return {
      id: response.id,
      tenant_id: response.tenant_id,
      name: response.name,
      channel: response.channel,
      subject: response.subject,
      content: response.content,
      variables: response.variables,
      required_variables: response.required_variables,
      trigger_event: response.trigger_event,
      category: response.category,
      is_active: response.is_active,
      created_at: response.created_at,
      updated_at: response.updated_at,
    };
  },

  /**
   * Create a new notification template
   */
  createTemplate: async (templateData: CreateNotificationTemplateRequest): Promise<NotificationTemplate> => {
    const client = tithiApiClient();
    const response = await client.post<NotificationTemplateResponse>('/notifications/templates', templateData);
    return {
      id: response.id,
      tenant_id: response.tenant_id,
      name: response.name,
      channel: response.channel,
      subject: response.subject,
      content: response.content,
      variables: response.variables,
      required_variables: response.required_variables,
      trigger_event: response.trigger_event,
      category: response.category,
      is_active: response.is_active,
      created_at: response.created_at,
      updated_at: response.updated_at,
    };
  },

  /**
   * Update an existing notification template
   */
  updateTemplate: async (templateId: string, templateData: UpdateNotificationTemplateRequest): Promise<NotificationTemplate> => {
    const client = tithiApiClient();
    const response = await client.put<NotificationTemplateResponse>(`/notifications/templates/${templateId}`, templateData);
    return {
      id: response.id,
      tenant_id: response.tenant_id,
      name: response.name,
      channel: response.channel,
      subject: response.subject,
      content: response.content,
      variables: response.variables,
      required_variables: response.required_variables,
      trigger_event: response.trigger_event,
      category: response.category,
      is_active: response.is_active,
      created_at: response.created_at,
      updated_at: response.updated_at,
    };
  },

  /**
   * Delete a notification template
   */
  deleteTemplate: async (templateId: string): Promise<void> => {
    const client = tithiApiClient();
    await client.delete(`/notifications/templates/${templateId}`);
  },

  /**
   * Preview a notification template with sample data
   */
  previewTemplate: async (templateId: string, sampleData: PlaceholderData): Promise<PreviewNotificationResponse> => {
    const client = tithiApiClient();
    const request: PreviewNotificationRequest = {
      template_id: templateId,
      sample_data: sampleData,
    };
    return client.post<PreviewNotificationResponse>('/notifications/templates/preview', request);
  },

  /**
   * Send a test notification
   */
  sendTestNotification: async (templateId: string, sampleData: PlaceholderData): Promise<{ success: boolean; message: string }> => {
    const client = tithiApiClient();
    const request: PreviewNotificationRequest = {
      template_id: templateId,
      sample_data: sampleData,
    };
    return client.post<{ success: boolean; message: string }>('/notifications/templates/test', request);
  },

  /**
   * Get quiet hours configuration
   */
  getQuietHours: async (): Promise<QuietHoursConfig> => {
    const client = tithiApiClient();
    return client.get<QuietHoursConfig>('/notifications/quiet-hours');
  },

  /**
   * Update quiet hours configuration
   */
  updateQuietHours: async (config: UpdateQuietHoursRequest): Promise<QuietHoursConfig> => {
    const client = tithiApiClient();
    const response = await client.put<UpdateQuietHoursResponse>('/notifications/quiet-hours', config);
    return {
      enabled: response.enabled,
      start_time: response.start_time,
      end_time: response.end_time,
      timezone: response.timezone,
    };
  },
};

/**
 * Utility functions for notifications
 */
export const notificationsUtils = {
  /**
   * Validate notification template data
   */
  validateTemplate: (template: NotificationTemplateFormData): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!template.name?.trim()) {
      errors.push('Template name is required');
    }

    if (!template.content?.trim()) {
      errors.push('Template content is required');
    }

    if (!template.channel) {
      errors.push('Notification channel is required');
    }

    if (template.channel === 'email' && !template.subject?.trim()) {
      errors.push('Email subject is required for email notifications');
    }

    if (template.required_variables && template.required_variables.length > 0) {
      const missingPlaceholders = template.required_variables.filter(
        placeholder => !template.content.includes(`{${placeholder}}`)
      );
      if (missingPlaceholders.length > 0) {
        errors.push(`Missing required placeholders: ${missingPlaceholders.join(', ')}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  },

  /**
   * Extract placeholders from template content
   */
  extractPlaceholders: (content: string): string[] => {
    const placeholderRegex = /\{([^}]+)\}/g;
    const placeholders: string[] = [];
    let match;

    while ((match = placeholderRegex.exec(content)) !== null) {
      if (!placeholders.includes(match[1])) {
        placeholders.push(match[1]);
      }
    }

    return placeholders;
  },

  /**
   * Validate placeholder names
   */
  validatePlaceholders: (placeholders: string[]): { isValid: boolean; invalidPlaceholders: string[] } => {
    const { AVAILABLE_PLACEHOLDERS } = require('../types/notifications');
    const invalidPlaceholders = placeholders.filter(
      placeholder => !AVAILABLE_PLACEHOLDERS.includes(placeholder as any)
    );

    return {
      isValid: invalidPlaceholders.length === 0,
      invalidPlaceholders,
    };
  },

  /**
   * Get template category from trigger event
   */
  getCategoryFromTrigger: (triggerEvent?: string): string => {
    if (!triggerEvent) return 'confirmation';
    
    if (triggerEvent.includes('reminder')) return 'reminder';
    if (triggerEvent.includes('follow_up')) return 'follow_up';
    if (triggerEvent.includes('cancelled')) return 'cancellation';
    if (triggerEvent.includes('rescheduled')) return 'reschedule';
    
    return 'confirmation';
  },

  /**
   * Format template for display
   */
  formatTemplateForDisplay: (template: NotificationTemplate): string => {
    let display = `${template.name} (${template.channel})`;
    if (template.category) {
      display += ` - ${template.category}`;
    }
    return display;
  },

  /**
   * Check if template limit is reached
   */
  checkTemplateLimit: (templates: NotificationTemplate[], category: string): { canAdd: boolean; reason?: string } => {
    const { TEMPLATE_LIMITS } = require('../types/notifications');
    
    if (templates.length >= TEMPLATE_LIMITS.MAX_TEMPLATES) {
      return {
        canAdd: false,
        reason: `Maximum of ${TEMPLATE_LIMITS.MAX_TEMPLATES} templates allowed`,
      };
    }

    if (category === 'confirmation') {
      const confirmationTemplates = templates.filter(t => t.category === 'confirmation');
      if (confirmationTemplates.length >= TEMPLATE_LIMITS.MAX_CONFIRMATION_TEMPLATES) {
        return {
          canAdd: false,
          reason: `Maximum of ${TEMPLATE_LIMITS.MAX_CONFIRMATION_TEMPLATES} confirmation template allowed`,
        };
      }
    }

    if (category === 'reminder') {
      const reminderTemplates = templates.filter(t => t.category === 'reminder');
      if (reminderTemplates.length >= TEMPLATE_LIMITS.MAX_REMINDER_TEMPLATES) {
        return {
          canAdd: false,
          reason: `Maximum of ${TEMPLATE_LIMITS.MAX_REMINDER_TEMPLATES} reminder templates allowed`,
        };
      }
    }

    return { canAdd: true };
  },

  /**
   * Generate idempotency key for template operations
   */
  generateIdempotencyKey: (operation: string, templateId?: string): string => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `${operation}-${templateId || 'new'}-${timestamp}-${random}`;
  },
};
