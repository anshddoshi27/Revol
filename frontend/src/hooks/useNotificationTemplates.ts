/**
 * useNotificationTemplates Hook
 * 
 * Custom hook for managing notification template state and operations.
 * Handles template CRUD operations, validation, and form state management.
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { notificationsService, notificationsUtils } from '../api/services/notifications';
import type {
  NotificationTemplate,
  NotificationTemplateFormData,
  CreateNotificationTemplateRequest,
  UpdateNotificationTemplateRequest,
  PlaceholderData,
  QuietHoursConfig,
  UpdateQuietHoursRequest,
  NotificationValidationError,
} from '../api/types/notifications';

interface UseNotificationTemplatesOptions {
  initialTemplates?: NotificationTemplate[];
  onTemplateCreated?: (template: NotificationTemplate) => void;
  onTemplateUpdated?: (template: NotificationTemplate) => void;
  onTemplateDeleted?: (templateId: string) => void;
  onError?: (error: Error) => void;
}

interface UseNotificationTemplatesReturn {
  // State
  templates: NotificationTemplate[];
  isLoading: boolean;
  isSubmitting: boolean;
  errors: Record<string, string>;
  validationErrors: NotificationValidationError[];

  // Template operations
  createTemplate: (templateData: NotificationTemplateFormData) => Promise<NotificationTemplate | null>;
  updateTemplate: (templateId: string, templateData: NotificationTemplateFormData) => Promise<NotificationTemplate | null>;
  deleteTemplate: (templateId: string) => Promise<boolean>;
  getTemplate: (templateId: string) => Promise<NotificationTemplate | null>;

  // Preview operations
  previewTemplate: (templateId: string, sampleData: PlaceholderData) => Promise<string | null>;
  sendTestNotification: (templateId: string, sampleData: PlaceholderData) => Promise<boolean>;

  // Quiet hours operations
  getQuietHours: () => Promise<QuietHoursConfig | null>;
  updateQuietHours: (config: UpdateQuietHoursRequest) => Promise<boolean>;

  // Validation
  validateTemplate: (template: NotificationTemplateFormData) => { isValid: boolean; errors: string[] };
  checkTemplateLimit: (category: string) => { canAdd: boolean; reason?: string };

  // Utility functions
  clearErrors: () => void;
  refreshTemplates: () => Promise<void>;

  // Computed values
  templatesByCategory: Record<string, NotificationTemplate[]>;
  canAddConfirmation: boolean;
  canAddReminder: boolean;
  totalTemplates: number;
}

export const useNotificationTemplates = (
  options: UseNotificationTemplatesOptions = {}
): UseNotificationTemplatesReturn => {
  const { 
    initialTemplates = [], 
    onTemplateCreated, 
    onTemplateUpdated, 
    onTemplateDeleted, 
    onError 
  } = options;

  // State
  const [templates, setTemplates] = useState<NotificationTemplate[]>(initialTemplates);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [validationErrors, setValidationErrors] = useState<NotificationValidationError[]>([]);

  // Load templates on mount
  useEffect(() => {
    if (initialTemplates.length === 0) {
      refreshTemplates();
    }
  }, []);

  // Template operations
  const createTemplate = useCallback(async (templateData: NotificationTemplateFormData): Promise<NotificationTemplate | null> => {
    try {
      setIsSubmitting(true);
      clearErrors();

      // Validate template data
      const validation = notificationsUtils.validateTemplate(templateData);
      if (!validation.isValid) {
        setErrors({ general: validation.errors.join(', ') });
        return null;
      }

      // Check template limits
      const limitCheck = checkTemplateLimit(templateData.category || 'confirmation');
      if (!limitCheck.canAdd) {
        setErrors({ general: limitCheck.reason || 'Template limit reached' });
        return null;
      }

      // Convert to API request format
      const createRequest: CreateNotificationTemplateRequest = {
        name: templateData.name,
        channel: templateData.channel,
        subject: templateData.subject,
        content: templateData.content,
        required_variables: templateData.required_variables,
        trigger_event: templateData.trigger_event,
        category: templateData.category,
        is_active: templateData.is_active,
      };

      // Create template via API
      const newTemplate = await notificationsService.createTemplate(createRequest);
      
      // Update local state
      setTemplates(prev => [...prev, newTemplate]);
      
      // Callback
      if (onTemplateCreated) {
        onTemplateCreated(newTemplate);
      }

      return newTemplate;
    } catch (error: any) {
      console.error('Failed to create template:', error);
      
      // Handle validation errors
      if (error.status === 400 && error.validation_errors) {
        const validationErrors: NotificationValidationError[] = error.validation_errors.map((err: any) => ({
          field: err.field,
          message: err.message,
          code: err.code,
        }));
        setValidationErrors(validationErrors);
      } else {
        setErrors({ 
          general: error.message || 'Failed to create template. Please try again.' 
        });
      }

      if (onError) {
        onError(error);
      }

      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [onTemplateCreated, onError]);

  const updateTemplate = useCallback(async (templateId: string, templateData: NotificationTemplateFormData): Promise<NotificationTemplate | null> => {
    try {
      setIsSubmitting(true);
      clearErrors();

      // Validate template data
      const validation = notificationsUtils.validateTemplate(templateData);
      if (!validation.isValid) {
        setErrors({ general: validation.errors.join(', ') });
        return null;
      }

      // Convert to API request format
      const updateRequest: UpdateNotificationTemplateRequest = {
        name: templateData.name,
        channel: templateData.channel,
        subject: templateData.subject,
        content: templateData.content,
        required_variables: templateData.required_variables,
        trigger_event: templateData.trigger_event,
        category: templateData.category,
        is_active: templateData.is_active,
      };

      // Update template via API
      const updatedTemplate = await notificationsService.updateTemplate(templateId, updateRequest);
      
      // Update local state
      setTemplates(prev => prev.map(template => 
        template.id === templateId ? updatedTemplate : template
      ));
      
      // Callback
      if (onTemplateUpdated) {
        onTemplateUpdated(updatedTemplate);
      }

      return updatedTemplate;
    } catch (error: any) {
      console.error('Failed to update template:', error);
      
      // Handle validation errors
      if (error.status === 400 && error.validation_errors) {
        const validationErrors: NotificationValidationError[] = error.validation_errors.map((err: any) => ({
          field: err.field,
          message: err.message,
          code: err.code,
        }));
        setValidationErrors(validationErrors);
      } else {
        setErrors({ 
          general: error.message || 'Failed to update template. Please try again.' 
        });
      }

      if (onError) {
        onError(error);
      }

      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [onTemplateUpdated, onError]);

  const deleteTemplate = useCallback(async (templateId: string): Promise<boolean> => {
    try {
      setIsSubmitting(true);
      clearErrors();

      // Delete template via API
      await notificationsService.deleteTemplate(templateId);
      
      // Update local state
      setTemplates(prev => prev.filter(template => template.id !== templateId));
      
      // Callback
      if (onTemplateDeleted) {
        onTemplateDeleted(templateId);
      }

      return true;
    } catch (error: any) {
      console.error('Failed to delete template:', error);
      setErrors({ 
        general: error.message || 'Failed to delete template. Please try again.' 
      });

      if (onError) {
        onError(error);
      }

      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [onTemplateDeleted, onError]);

  const getTemplate = useCallback(async (templateId: string): Promise<NotificationTemplate | null> => {
    try {
      setIsLoading(true);
      clearErrors();

      const template = await notificationsService.getTemplate(templateId);
      return template;
    } catch (error: any) {
      console.error('Failed to get template:', error);
      setErrors({ 
        general: error.message || 'Failed to load template. Please try again.' 
      });

      if (onError) {
        onError(error);
      }

      return null;
    } finally {
      setIsLoading(false);
    }
  }, [onError]);

  // Preview operations
  const previewTemplate = useCallback(async (templateId: string, sampleData: PlaceholderData): Promise<string | null> => {
    try {
      const response = await notificationsService.previewTemplate(templateId, sampleData);
      return response.rendered_content;
    } catch (error: any) {
      console.error('Failed to preview template:', error);
      setErrors({ 
        preview: error.message || 'Failed to preview template. Please try again.' 
      });

      if (onError) {
        onError(error);
      }

      return null;
    }
  }, [onError]);

  const sendTestNotification = useCallback(async (templateId: string, sampleData: PlaceholderData): Promise<boolean> => {
    try {
      const response = await notificationsService.sendTestNotification(templateId, sampleData);
      return response.success;
    } catch (error: any) {
      console.error('Failed to send test notification:', error);
      setErrors({ 
        test: error.message || 'Failed to send test notification. Please try again.' 
      });

      if (onError) {
        onError(error);
      }

      return false;
    }
  }, [onError]);

  // Quiet hours operations
  const getQuietHours = useCallback(async (): Promise<QuietHoursConfig | null> => {
    try {
      setIsLoading(true);
      clearErrors();

      const config = await notificationsService.getQuietHours();
      return config;
    } catch (error: any) {
      console.error('Failed to get quiet hours:', error);
      setErrors({ 
        quietHours: error.message || 'Failed to load quiet hours configuration.' 
      });

      if (onError) {
        onError(error);
      }

      return null;
    } finally {
      setIsLoading(false);
    }
  }, [onError]);

  const updateQuietHours = useCallback(async (config: UpdateQuietHoursRequest): Promise<boolean> => {
    try {
      setIsSubmitting(true);
      clearErrors();

      await notificationsService.updateQuietHours(config);
      return true;
    } catch (error: any) {
      console.error('Failed to update quiet hours:', error);
      setErrors({ 
        quietHours: error.message || 'Failed to update quiet hours configuration.' 
      });

      if (onError) {
        onError(error);
      }

      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [onError]);

  // Validation
  const validateTemplate = useCallback((template: NotificationTemplateFormData) => {
    return notificationsUtils.validateTemplate(template);
  }, []);

  const checkTemplateLimit = useCallback((category: string) => {
    return notificationsUtils.checkTemplateLimit(templates, category);
  }, [templates]);

  // Utility functions
  const clearErrors = useCallback(() => {
    setErrors({});
    setValidationErrors([]);
  }, []);

  const refreshTemplates = useCallback(async () => {
    try {
      setIsLoading(true);
      clearErrors();

      const fetchedTemplates = await notificationsService.getTemplates();
      setTemplates(fetchedTemplates);
    } catch (error: any) {
      console.error('Failed to refresh templates:', error);
      setErrors({ 
        general: error.message || 'Failed to load templates. Please try again.' 
      });

      if (onError) {
        onError(error);
      }
    } finally {
      setIsLoading(false);
    }
  }, [onError]);

  // Computed values
  const templatesByCategory = useMemo(() => {
    return templates.reduce((acc, template) => {
      const category = template.category || 'confirmation';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(template);
      return acc;
    }, {} as Record<string, NotificationTemplate[]>);
  }, [templates]);

  const canAddConfirmation = useMemo(() => {
    return checkTemplateLimit('confirmation').canAdd;
  }, [templates]);

  const canAddReminder = useMemo(() => {
    return checkTemplateLimit('reminder').canAdd;
  }, [templates]);

  const totalTemplates = useMemo(() => {
    return templates.length;
  }, [templates]);

  return {
    // State
    templates,
    isLoading,
    isSubmitting,
    errors,
    validationErrors,

    // Template operations
    createTemplate,
    updateTemplate,
    deleteTemplate,
    getTemplate,

    // Preview operations
    previewTemplate,
    sendTestNotification,

    // Quiet hours operations
    getQuietHours,
    updateQuietHours,

    // Validation
    validateTemplate,
    checkTemplateLimit,

    // Utility functions
    clearErrors,
    refreshTemplates,

    // Computed values
    templatesByCategory,
    canAddConfirmation,
    canAddReminder,
    totalTemplates,
  };
};
