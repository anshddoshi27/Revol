/**
 * Step 4 Availability Observability
 * 
 * Observability hooks and utilities for tracking onboarding step 4 events.
 * Provides structured event tracking for availability calendar setup.
 */

import { analyticsService } from '../analytics';

export interface OnboardingStep4Event {
  event_type: 'onboarding.step4_started' | 'onboarding.step4_complete' | 'onboarding.time_block_created' | 'onboarding.time_block_updated' | 'onboarding.time_block_deleted' | 'onboarding.availability_copy_week' | 'onboarding.availability_overlap_detected' | 'onboarding.availability_validation_error';
  tenant_id?: string;
  step?: number;
  data?: Record<string, any>;
  timestamp: string;
}

export interface TimeBlockEventData {
  time_block_id?: string;
  staff_id?: string;
  staff_name?: string;
  day_of_week?: number;
  start_time?: string;
  end_time?: string;
  has_break?: boolean;
  is_recurring?: boolean;
}

export interface CopyWeekEventData {
  source_week_start?: string;
  target_week_start?: string;
  staff_count?: number;
  rules_copied?: number;
}

export interface OverlapEventData {
  staff_id?: string;
  day_of_week?: number;
  overlap_start?: string;
  overlap_end?: string;
  conflicting_blocks?: number;
}

export interface ValidationErrorEventData {
  error_type?: string;
  field?: string;
  message?: string;
  affected_rules?: number;
}

/**
 * Onboarding Step 4 Observability Service
 */
export const onboardingStep4Observability = {
  /**
   * Track step 4 started event
   */
  trackStepStarted: (data: { 
    has_step1_data: boolean; 
    has_step2_data: boolean; 
    has_step3_data: boolean;
    staff_count: number;
  }) => {
    const event: OnboardingStep4Event = {
      event_type: 'onboarding.step4_started',
      step: 4,
      data,
      timestamp: new Date().toISOString(),
    };

    analyticsService.track('onboarding.step4_started', event);
  },

  /**
   * Track step 4 completed event
   */
  trackStepCompleted: (data: {
    tenant_id: string;
    total_rules: number;
    staff_with_availability: number;
    total_hours_per_week: number;
    has_recurring_rules: boolean;
  }) => {
    const event: OnboardingStep4Event = {
      event_type: 'onboarding.step4_complete',
      tenant_id: data.tenant_id,
      step: 4,
      data,
      timestamp: new Date().toISOString(),
    };

    analyticsService.track('onboarding.step4_complete', event);
  },

  /**
   * Track time block created event
   */
  trackTimeBlockCreated: (data: TimeBlockEventData) => {
    const event: OnboardingStep4Event = {
      event_type: 'onboarding.time_block_created',
      data,
      timestamp: new Date().toISOString(),
    };

    analyticsService.track('onboarding.time_block_created', event);
  },

  /**
   * Track time block updated event
   */
  trackTimeBlockUpdated: (data: TimeBlockEventData) => {
    const event: OnboardingStep4Event = {
      event_type: 'onboarding.time_block_updated',
      data,
      timestamp: new Date().toISOString(),
    };

    analyticsService.track('onboarding.time_block_updated', event);
  },

  /**
   * Track time block deleted event
   */
  trackTimeBlockDeleted: (data: { time_block_id: string; staff_id: string }) => {
    const event: OnboardingStep4Event = {
      event_type: 'onboarding.time_block_deleted',
      data,
      timestamp: new Date().toISOString(),
    };

    analyticsService.track('onboarding.time_block_deleted', event);
  },

  /**
   * Track copy week event
   */
  trackCopyWeek: (data: CopyWeekEventData) => {
    const event: OnboardingStep4Event = {
      event_type: 'onboarding.availability_copy_week',
      data,
      timestamp: new Date().toISOString(),
    };

    analyticsService.track('onboarding.availability_copy_week', event);
  },

  /**
   * Track overlap detection event
   */
  trackOverlapDetected: (data: OverlapEventData) => {
    const event: OnboardingStep4Event = {
      event_type: 'onboarding.availability_overlap_detected',
      data,
      timestamp: new Date().toISOString(),
    };

    analyticsService.track('onboarding.availability_overlap_detected', event);
  },

  /**
   * Track validation error event
   */
  trackValidationError: (data: ValidationErrorEventData) => {
    const event: OnboardingStep4Event = {
      event_type: 'onboarding.availability_validation_error',
      data,
      timestamp: new Date().toISOString(),
    };

    analyticsService.track('onboarding.availability_validation_error', event);
  },
};

/**
 * Error tracking utilities for onboarding step 4
 */
export const onboardingStep4ErrorTracking = {
  /**
   * Track validation errors
   */
  trackValidationError: (error: { 
    field: string; 
    message: string; 
    context: string;
    rule_id?: string;
  }) => {
    analyticsService.track('onboarding.step4_validation_error', {
      error_type: 'validation',
      field: error.field,
      message: error.message,
      context: error.context,
      rule_id: error.rule_id,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Track API errors
   */
  trackApiError: (error: { 
    endpoint: string; 
    status_code: number; 
    error_code: string; 
    message: string;
    operation?: string;
  }) => {
    analyticsService.track('onboarding.step4_api_error', {
      error_type: 'api',
      endpoint: error.endpoint,
      status_code: error.status_code,
      error_code: error.error_code,
      message: error.message,
      operation: error.operation,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Track network errors
   */
  trackNetworkError: (error: { 
    endpoint: string; 
    error_type: string; 
    message: string;
    operation?: string;
  }) => {
    analyticsService.track('onboarding.step4_network_error', {
      error_type: 'network',
      endpoint: error.endpoint,
      network_error_type: error.error_type,
      message: error.message,
      operation: error.operation,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Track overlap detection errors
   */
  trackOverlapError: (error: { 
    staff_id: string; 
    day_of_week: number; 
    conflicting_blocks: string[];
    message: string;
  }) => {
    analyticsService.track('onboarding.step4_overlap_error', {
      error_type: 'overlap',
      staff_id: error.staff_id,
      day_of_week: error.day_of_week,
      conflicting_blocks: error.conflicting_blocks,
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  },
};

/**
 * Performance tracking utilities for onboarding step 4
 */
export const onboardingStep4PerformanceTracking = {
  /**
   * Track step load time
   */
  trackStepLoadTime: (loadTime: number) => {
    analyticsService.track('onboarding.step4_performance', {
      metric: 'step_load_time',
      value: loadTime,
      unit: 'milliseconds',
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Track time block creation time
   */
  trackTimeBlockCreationTime: (creationTime: number, blockData: { 
    has_break: boolean; 
    is_recurring: boolean;
    duration_minutes: number;
  }) => {
    analyticsService.track('onboarding.step4_performance', {
      metric: 'time_block_creation_time',
      value: creationTime,
      unit: 'milliseconds',
      has_break: blockData.has_break,
      is_recurring: blockData.is_recurring,
      duration_minutes: blockData.duration_minutes,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Track copy week operation time
   */
  trackCopyWeekTime: (copyTime: number, rulesCount: number) => {
    analyticsService.track('onboarding.step4_performance', {
      metric: 'copy_week_time',
      value: copyTime,
      unit: 'milliseconds',
      rules_count: rulesCount,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Track validation time
   */
  trackValidationTime: (validationTime: number, rulesCount: number) => {
    analyticsService.track('onboarding.step4_performance', {
      metric: 'validation_time',
      value: validationTime,
      unit: 'milliseconds',
      rules_count: rulesCount,
      timestamp: new Date().toISOString(),
    });
  },
};

/**
 * User interaction tracking utilities
 */
export const onboardingStep4InteractionTracking = {
  /**
   * Track calendar interactions
   */
  trackCalendarInteraction: (action: 'drag_start' | 'drag_end' | 'resize_start' | 'resize_end' | 'click', context: string) => {
    analyticsService.track('onboarding.step4_interaction', {
      interaction_type: 'calendar_interaction',
      action,
      context,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Track time picker interactions
   */
  trackTimePickerInteraction: (field: string, action: 'open' | 'select' | 'close', value?: string) => {
    analyticsService.track('onboarding.step4_interaction', {
      interaction_type: 'time_picker_interaction',
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
    analyticsService.track('onboarding.step4_interaction', {
      interaction_type: 'button_click',
      button,
      context,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Track staff selection
   */
  trackStaffSelection: (staff_id: string, staff_name: string, action: 'select' | 'deselect') => {
    analyticsService.track('onboarding.step4_interaction', {
      interaction_type: 'staff_selection',
      staff_id,
      staff_name,
      action,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Track day selection
   */
  trackDaySelection: (day_of_week: number, day_name: string, action: 'select' | 'deselect') => {
    analyticsService.track('onboarding.step4_interaction', {
      interaction_type: 'day_selection',
      day_of_week,
      day_name,
      action,
      timestamp: new Date().toISOString(),
    });
  },
};
