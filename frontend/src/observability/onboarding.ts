/**
 * Onboarding Observability
 * 
 * Observability hooks and utilities for tracking onboarding step 3 events.
 * Provides structured event tracking for service catalog creation.
 */

import { analyticsService } from '../analytics/analytics-service';

export interface OnboardingStep3Event {
  event_type: 'onboarding.step3_started' | 'onboarding.step3_complete' | 'onboarding.category_created' | 'onboarding.category_updated' | 'onboarding.category_deleted' | 'onboarding.service_created' | 'onboarding.service_updated' | 'onboarding.service_deleted' | 'onboarding.image_uploaded' | 'onboarding.image_upload_error';
  tenant_id?: string;
  step?: number;
  data?: Record<string, any>;
  timestamp: string;
}

export interface ServiceEventData {
  service_id?: string;
  service_name?: string;
  has_image?: boolean;
  has_special_requests?: boolean;
  category?: string;
  duration_minutes?: number;
  price_cents?: number;
}

export interface CategoryEventData {
  category_id?: string;
  category_name?: string;
  color?: string;
}

export interface ImageUploadEventData {
  service_id?: string;
  file_size?: number;
  file_type?: string;
  upload_duration?: number;
  error_code?: string;
}

/**
 * Onboarding Step 3 Observability Service
 */
export const onboardingStep3Observability = {
  /**
   * Track step 3 started event
   */
  trackStepStarted: (data: { has_step1_data: boolean; has_step2_data: boolean }) => {
    const event: OnboardingStep3Event = {
      event_type: 'onboarding.step3_started',
      step: 3,
      data,
      timestamp: new Date().toISOString(),
    };

    analyticsService.emitEvent('onboarding.step3_started', event);
  },

  /**
   * Track step 3 completed event
   */
  trackStepCompleted: (data: {
    tenant_id: string;
    total_services: number;
    total_categories: number;
    services_with_images: number;
    services_with_special_requests: number;
  }) => {
    const event: OnboardingStep3Event = {
      event_type: 'onboarding.step3_complete',
      tenant_id: data.tenant_id,
      step: 3,
      data,
      timestamp: new Date().toISOString(),
    };

    analyticsService.emitEvent('onboarding.step3_complete', event);
  },

  /**
   * Track category created event
   */
  trackCategoryCreated: (data: CategoryEventData) => {
    const event: OnboardingStep3Event = {
      event_type: 'onboarding.category_created',
      data,
      timestamp: new Date().toISOString(),
    };

    analyticsService.emitEvent('onboarding.category_created', event);
  },

  /**
   * Track category updated event
   */
  trackCategoryUpdated: (data: CategoryEventData) => {
    const event: OnboardingStep3Event = {
      event_type: 'onboarding.category_updated',
      data,
      timestamp: new Date().toISOString(),
    };

    analyticsService.emitEvent('onboarding.category_updated', event);
  },

  /**
   * Track category deleted event
   */
  trackCategoryDeleted: (data: { category_id: string }) => {
    const event: OnboardingStep3Event = {
      event_type: 'onboarding.category_deleted',
      data,
      timestamp: new Date().toISOString(),
    };

    analyticsService.emitEvent('onboarding.category_deleted', event);
  },

  /**
   * Track service created event
   */
  trackServiceCreated: (data: ServiceEventData) => {
    const event: OnboardingStep3Event = {
      event_type: 'onboarding.service_created',
      data,
      timestamp: new Date().toISOString(),
    };

    analyticsService.emitEvent('onboarding.service_created', event);
  },

  /**
   * Track service updated event
   */
  trackServiceUpdated: (data: ServiceEventData) => {
    const event: OnboardingStep3Event = {
      event_type: 'onboarding.service_updated',
      data,
      timestamp: new Date().toISOString(),
    };

    analyticsService.emitEvent('onboarding.service_updated', event);
  },

  /**
   * Track service deleted event
   */
  trackServiceDeleted: (data: { service_id: string }) => {
    const event: OnboardingStep3Event = {
      event_type: 'onboarding.service_deleted',
      data,
      timestamp: new Date().toISOString(),
    };

    analyticsService.emitEvent('onboarding.service_deleted', event);
  },

  /**
   * Track image upload success event
   */
  trackImageUploaded: (data: ImageUploadEventData) => {
    const event: OnboardingStep3Event = {
      event_type: 'onboarding.image_uploaded',
      data,
      timestamp: new Date().toISOString(),
    };

    analyticsService.emitEvent('onboarding.image_uploaded', event);
  },

  /**
   * Track image upload error event
   */
  trackImageUploadError: (data: ImageUploadEventData & { error_message: string }) => {
    const event: OnboardingStep3Event = {
      event_type: 'onboarding.image_upload_error',
      data,
      timestamp: new Date().toISOString(),
    };

    analyticsService.emitEvent('onboarding.image_upload_error', event);
  },
};

/**
 * Error tracking utilities for onboarding step 3
 */
export const onboardingStep3ErrorTracking = {
  /**
   * Track validation errors
   */
  trackValidationError: (error: { field: string; message: string; context: string }) => {
    analyticsService.emitEvent('onboarding.step3_validation_error', {
      error_type: 'validation',
      field: error.field,
      message: error.message,
      context: error.context,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Track API errors
   */
  trackApiError: (error: { endpoint: string; status_code: number; error_code: string; message: string }) => {
    analyticsService.emitEvent('onboarding.step3_api_error', {
      error_type: 'api',
      endpoint: error.endpoint,
      status_code: error.status_code,
      error_code: error.error_code,
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Track network errors
   */
  trackNetworkError: (error: { endpoint: string; error_type: string; message: string }) => {
    analyticsService.emitEvent('onboarding.step3_network_error', {
      error_type: 'network',
      endpoint: error.endpoint,
      network_error_type: error.error_type,
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Track file upload errors
   */
  trackFileUploadError: (error: { file_type: string; file_size: number; error_type: string; message: string }) => {
    analyticsService.emitEvent('onboarding.step3_file_upload_error', {
      error_type: 'file_upload',
      file_type: error.file_type,
      file_size: error.file_size,
      upload_error_type: error.error_type,
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  },
};

/**
 * Performance tracking utilities for onboarding step 3
 */
export const onboardingStep3PerformanceTracking = {
  /**
   * Track step load time
   */
  trackStepLoadTime: (loadTime: number) => {
    analyticsService.emitEvent('onboarding.step3_performance', {
      metric: 'step_load_time',
      value: loadTime,
      unit: 'milliseconds',
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Track service creation time
   */
  trackServiceCreationTime: (creationTime: number, serviceData: { has_image: boolean; has_special_requests: boolean }) => {
    analyticsService.emitEvent('onboarding.step3_performance', {
      metric: 'service_creation_time',
      value: creationTime,
      unit: 'milliseconds',
      has_image: serviceData.has_image,
      has_special_requests: serviceData.has_special_requests,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Track category creation time
   */
  trackCategoryCreationTime: (creationTime: number) => {
    analyticsService.emitEvent('onboarding.step3_performance', {
      metric: 'category_creation_time',
      value: creationTime,
      unit: 'milliseconds',
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Track image upload time
   */
  trackImageUploadTime: (uploadTime: number, fileSize: number) => {
    analyticsService.emitEvent('onboarding.step3_performance', {
      metric: 'image_upload_time',
      value: uploadTime,
      unit: 'milliseconds',
      file_size: fileSize,
      timestamp: new Date().toISOString(),
    });
  },
};

/**
 * User interaction tracking utilities
 */
export const onboardingStep3InteractionTracking = {
  /**
   * Track form field interactions
   */
  trackFieldInteraction: (field: string, action: 'focus' | 'blur' | 'change', value?: any) => {
    analyticsService.emitEvent('onboarding.step3_interaction', {
      interaction_type: 'field_interaction',
      field,
      action,
      has_value: value !== undefined && value !== null && value !== '',
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Track button clicks
   */
  trackButtonClick: (button: string, context: string) => {
    analyticsService.emitEvent('onboarding.step3_interaction', {
      interaction_type: 'button_click',
      button,
      context,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Track tab switches
   */
  trackTabSwitch: (fromTab: string, toTab: string) => {
    analyticsService.emitEvent('onboarding.step3_interaction', {
      interaction_type: 'tab_switch',
      from_tab: fromTab,
      to_tab: toTab,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Track drag and drop interactions
   */
  trackDragAndDrop: (action: 'drag_start' | 'drag_over' | 'drop' | 'drag_leave', fileType?: string) => {
    analyticsService.emitEvent('onboarding.step3_interaction', {
      interaction_type: 'drag_and_drop',
      action,
      file_type: fileType,
      timestamp: new Date().toISOString(),
    });
  },
};
