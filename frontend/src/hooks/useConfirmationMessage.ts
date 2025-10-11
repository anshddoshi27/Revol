/**
 * useConfirmationMessage Hook
 * 
 * Custom hook for managing confirmation message state and operations.
 * Handles confirmation message CRUD operations, validation, and form state management.
 */

import { useState, useCallback, useMemo } from 'react';
import { policiesService, policiesUtils } from '../api/services/policies';
import { telemetry } from '../services/telemetry';
import type {
  ConfirmationMessage,
  ConfirmationMessageFormData,
  ConfirmationMessageValidationError,
  CreateConfirmationMessageRequest,
  UpdateConfirmationMessageRequest,
  QuickPasteOption,
  ServiceDetails,
  AvailabilityDetails,
  BusinessDetails,
} from '../api/types/policies';

interface UseConfirmationMessageOptions {
  initialMessage?: ConfirmationMessage;
  onMessageCreated?: (message: ConfirmationMessage) => void;
  onMessageUpdated?: (message: ConfirmationMessage) => void;
  onMessageDeleted?: (messageId: string) => void;
  onError?: (error: Error) => void;
}

interface UseConfirmationMessageReturn {
  // State
  message: ConfirmationMessage | null;
  isLoading: boolean;
  isSubmitting: boolean;
  errors: Record<string, string>;
  validationErrors: ConfirmationMessageValidationError[];

  // Operations
  createOrUpdateMessage: (messageData: ConfirmationMessageFormData) => Promise<ConfirmationMessage | null>;
  updateMessage: (messageId: string, messageData: Partial<ConfirmationMessageFormData>) => Promise<ConfirmationMessage | null>;
  deleteMessage: (messageId: string) => Promise<boolean>;
  loadMessage: () => Promise<void>;
  clearErrors: () => void;

  // Validation
  validateMessage: (messageData: ConfirmationMessageFormData) => ConfirmationMessageValidationError[];
  isMessageValid: (messageData: ConfirmationMessageFormData) => boolean;

  // Quick paste functionality
  getQuickPasteOptions: (serviceDetails?: ServiceDetails, availabilityDetails?: AvailabilityDetails, businessDetails?: BusinessDetails) => QuickPasteOption[];
  insertQuickPaste: (content: string, option: QuickPasteOption, cursorPosition: number) => string;

  // Preview functionality
  previewMessage: (content: string) => Promise<string | null>;

  // Utilities
  extractVariables: (content: string) => string[];
  replaceVariables: (content: string, variables: Record<string, string>) => string;
}

export const useConfirmationMessage = (options: UseConfirmationMessageOptions = {}): UseConfirmationMessageReturn => {
  const { initialMessage, onMessageCreated, onMessageUpdated, onMessageDeleted, onError } = options;

  // State
  const [message, setMessage] = useState<ConfirmationMessage | null>(initialMessage || null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [validationErrors, setValidationErrors] = useState<ConfirmationMessageValidationError[]>([]);

  // Clear errors
  const clearErrors = useCallback(() => {
    setErrors({});
    setValidationErrors([]);
  }, []);

  // Validate message data
  const validateMessage = useCallback((messageData: ConfirmationMessageFormData): ConfirmationMessageValidationError[] => {
    const errors: ConfirmationMessageValidationError[] = [];
    const validationErrors = policiesUtils.validateConfirmationMessage(messageData);

    validationErrors.forEach((error, index) => {
      errors.push({
        field: 'general',
        message: error,
        code: `VALIDATION_ERROR_${index}`,
      });
    });

    return errors;
  }, []);

  // Check if message is valid
  const isMessageValid = useCallback((messageData: ConfirmationMessageFormData): boolean => {
    return validateMessage(messageData).length === 0;
  }, [validateMessage]);

  // Load message
  const loadMessage = useCallback(async () => {
    try {
      setIsLoading(true);
      clearErrors();

      const response = await policiesService.getConfirmationMessage();
      if (response) {
        const messageData: ConfirmationMessage = {
          id: response.id,
          tenant_id: response.tenant_id,
          content: response.content,
          is_active: response.is_active,
          created_at: response.created_at,
          updated_at: response.updated_at,
        };
        setMessage(messageData);
      }
    } catch (error: any) {
      console.error('Failed to load confirmation message:', error);
      setErrors({ general: error.message || 'Failed to load confirmation message' });
      if (onError) {
        onError(error);
      }
    } finally {
      setIsLoading(false);
    }
  }, [clearErrors, onError]);

  // Create or update message
  const createOrUpdateMessage = useCallback(async (messageData: ConfirmationMessageFormData): Promise<ConfirmationMessage | null> => {
    try {
      setIsSubmitting(true);
      clearErrors();

      // Validate message data
      const validationErrors = validateMessage(messageData);
      if (validationErrors.length > 0) {
        setValidationErrors(validationErrors);
        return null;
      }

      // Convert to API request format
      const createRequest: CreateConfirmationMessageRequest = {
        content: messageData.content,
        is_active: messageData.is_active,
      };

      // Create or update message via API
      const response = await policiesService.createOrUpdateConfirmationMessage(createRequest);
      
      // Convert response to ConfirmationMessage
      const newMessage: ConfirmationMessage = {
        id: response.id,
        tenant_id: response.tenant_id,
        content: response.content,
        is_active: response.is_active,
        created_at: response.created_at,
        updated_at: response.updated_at,
      };

      // Update local state
      setMessage(newMessage);

      // Track success event
      telemetry.trackConfirmationMessageEvent('save_success', {
        message_id: newMessage.id,
        content_length: newMessage.content.length,
        is_active: newMessage.is_active,
      });

      // Call success callback
      if (message?.id) {
        if (onMessageUpdated) {
          onMessageUpdated(newMessage);
        }
      } else {
        if (onMessageCreated) {
          onMessageCreated(newMessage);
        }
      }

      return newMessage;
    } catch (error: any) {
      console.error('Failed to create/update confirmation message:', error);
      
      // Handle validation errors
      if (error.status === 422 && error.validation_errors) {
        const validationErrors: ConfirmationMessageValidationError[] = error.validation_errors.map((err: any) => ({
          field: err.field,
          message: err.message,
          code: err.code,
        }));
        setValidationErrors(validationErrors);
      } else {
        setErrors({ 
          general: error.message || 'Failed to save confirmation message. Please try again.' 
        });
      }

      // Track error event
      telemetry.trackConfirmationMessageEvent('save_error', {
        error_code: error.error_code || 'UNKNOWN_ERROR',
        error_message: error.message,
      });

      if (onError) {
        onError(error);
      }

      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [message, validateMessage, clearErrors, onMessageCreated, onMessageUpdated, onError]);

  // Update existing message
  const updateMessage = useCallback(async (messageId: string, messageData: Partial<ConfirmationMessageFormData>): Promise<ConfirmationMessage | null> => {
    try {
      setIsSubmitting(true);
      clearErrors();

      // Convert to API request format
      const updateRequest: UpdateConfirmationMessageRequest = {};
      
      if (messageData.content !== undefined) {
        updateRequest.content = messageData.content;
      }
      if (messageData.is_active !== undefined) {
        updateRequest.is_active = messageData.is_active;
      }

      // Update message via API
      const response = await policiesService.updateConfirmationMessage(messageId, updateRequest);
      
      // Convert response to ConfirmationMessage
      const updatedMessage: ConfirmationMessage = {
        id: response.id,
        tenant_id: response.tenant_id,
        content: response.content,
        is_active: response.is_active,
        created_at: response.created_at,
        updated_at: response.updated_at,
      };

      // Update local state
      setMessage(updatedMessage);

      // Call success callback
      if (onMessageUpdated) {
        onMessageUpdated(updatedMessage);
      }

      return updatedMessage;
    } catch (error: any) {
      console.error('Failed to update confirmation message:', error);
      
      // Handle validation errors
      if (error.status === 422 && error.validation_errors) {
        const validationErrors: ConfirmationMessageValidationError[] = error.validation_errors.map((err: any) => ({
          field: err.field,
          message: err.message,
          code: err.code,
        }));
        setValidationErrors(validationErrors);
      } else {
        setErrors({ 
          general: error.message || 'Failed to update confirmation message. Please try again.' 
        });
      }

      if (onError) {
        onError(error);
      }

      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [clearErrors, onMessageUpdated, onError]);

  // Delete message
  const deleteMessage = useCallback(async (messageId: string): Promise<boolean> => {
    try {
      setIsSubmitting(true);
      clearErrors();

      await policiesService.deleteConfirmationMessage(messageId);
      
      // Update local state
      setMessage(null);

      // Call success callback
      if (onMessageDeleted) {
        onMessageDeleted(messageId);
      }

      return true;
    } catch (error: any) {
      console.error('Failed to delete confirmation message:', error);
      setErrors({ 
        general: error.message || 'Failed to delete confirmation message. Please try again.' 
      });

      if (onError) {
        onError(error);
      }

      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [clearErrors, onMessageDeleted, onError]);

  // Get quick paste options
  const getQuickPasteOptions = useCallback((
    serviceDetails?: ServiceDetails,
    availabilityDetails?: AvailabilityDetails,
    businessDetails?: BusinessDetails
  ): QuickPasteOption[] => {
    const options: QuickPasteOption[] = [];

    // Service details
    if (serviceDetails) {
      options.push(
        {
          id: 'service_name',
          label: 'Service Name',
          value: `{service_name}`,
          description: serviceDetails.name,
          category: 'service',
        },
        {
          id: 'service_description',
          label: 'Service Description',
          value: `{service_description}`,
          description: serviceDetails.description,
          category: 'service',
        },
        {
          id: 'service_duration',
          label: 'Service Duration',
          value: `{service_duration}`,
          description: `${serviceDetails.duration_minutes} minutes`,
          category: 'service',
        },
        {
          id: 'service_price',
          label: 'Service Price',
          value: `{service_price}`,
          description: `$${(serviceDetails.price_cents / 100).toFixed(2)}`,
          category: 'price',
        }
      );

      if (serviceDetails.instructions) {
        options.push({
          id: 'service_instructions',
          label: 'Service Instructions',
          value: `{service_instructions}`,
          description: serviceDetails.instructions,
          category: 'service',
        });
      }
    }

    // Availability details
    if (availabilityDetails) {
      options.push(
        {
          id: 'appointment_date',
          label: 'Appointment Date',
          value: `{appointment_date}`,
          description: availabilityDetails.date,
          category: 'time',
        },
        {
          id: 'appointment_time',
          label: 'Appointment Time',
          value: `{appointment_time}`,
          description: availabilityDetails.time,
          category: 'time',
        },
        {
          id: 'timezone',
          label: 'Timezone',
          value: `{timezone}`,
          description: availabilityDetails.timezone,
          category: 'time',
        }
      );
    }

    // Business details
    if (businessDetails) {
      options.push(
        {
          id: 'business_name',
          label: 'Business Name',
          value: `{business_name}`,
          description: businessDetails.name,
          category: 'business',
        }
      );

      if (businessDetails.address) {
        options.push({
          id: 'business_address',
          label: 'Business Address',
          value: `{business_address}`,
          description: businessDetails.address,
          category: 'business',
        });
      }

      if (businessDetails.phone) {
        options.push({
          id: 'business_phone',
          label: 'Business Phone',
          value: `{business_phone}`,
          description: businessDetails.phone,
          category: 'contact',
        });
      }

      if (businessDetails.email) {
        options.push({
          id: 'business_email',
          label: 'Business Email',
          value: `{business_email}`,
          description: businessDetails.email,
          category: 'contact',
        });
      }
    }

    // Common options
    options.push(
      {
        id: 'customer_name',
        label: 'Customer Name',
        value: `{customer_name}`,
        description: 'Customer\'s name',
        category: 'contact',
      }
    );

    return options;
  }, []);

  // Insert quick paste option
  const insertQuickPaste = useCallback((content: string, option: QuickPasteOption, cursorPosition: number): string => {
    const before = content.substring(0, cursorPosition);
    const after = content.substring(cursorPosition);
    return before + option.value + after;
  }, []);

  // Preview message
  const previewMessage = useCallback(async (content: string): Promise<string | null> => {
    try {
      const response = await policiesService.previewConfirmationMessage(content);
      return response.preview;
    } catch (error: any) {
      console.error('Failed to preview message:', error);
      if (onError) {
        onError(error);
      }
      return null;
    }
  }, [onError]);

  // Extract variables from content
  const extractVariables = useCallback((content: string): string[] => {
    return policiesUtils.extractVariables(content);
  }, []);

  // Replace variables in content
  const replaceVariables = useCallback((content: string, variables: Record<string, string>): string => {
    return policiesUtils.replaceVariables(content, variables);
  }, []);

  return {
    // State
    message,
    isLoading,
    isSubmitting,
    errors,
    validationErrors,

    // Operations
    createOrUpdateMessage,
    updateMessage,
    deleteMessage,
    loadMessage,
    clearErrors,

    // Validation
    validateMessage,
    isMessageValid,

    // Quick paste functionality
    getQuickPasteOptions,
    insertQuickPaste,

    // Preview functionality
    previewMessage,

    // Utilities
    extractVariables,
    replaceVariables,
  };
};
