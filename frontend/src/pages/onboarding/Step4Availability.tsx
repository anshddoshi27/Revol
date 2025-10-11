/**
 * Step4Availability Page
 * 
 * Fourth step of the onboarding wizard - Default Availability.
 * This page allows business owners to set up staff availability schedules.
 */

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowRight, AlertCircle, CheckCircle, Clock, Users } from 'lucide-react';
import { WorkingGridCalendar } from '../../components/onboarding/WorkingGridCalendar';
import { useAvailabilityCalendar } from '../../hooks/useAvailabilityCalendar';
import { onboardingStep4Observability } from '../../observability/step4-availability';
import type { TimeBlock, StaffMember } from '../../api/types';
import type { BusinessDetailsFormData } from '../../api/types/onboarding';

interface Step4AvailabilityState {
  step1Data?: BusinessDetailsFormData;
  step2Data?: any;
  step3Data?: any;
  prefill?: any;
}

export const Step4Availability: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Initialize state from navigation state or localStorage
  const [state, setState] = useState<Step4AvailabilityState>(() => {
    // Try to get from navigation state first
    if (location.state) {
      return location.state as Step4AvailabilityState;
    }
    
    // Fallback to localStorage
    try {
      const savedOnboardingData = localStorage.getItem('onboarding_data');
      if (savedOnboardingData) {
        return JSON.parse(savedOnboardingData);
      }
    } catch (error) {
      console.error('Failed to parse saved onboarding data:', error);
    }
    
    return {};
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get staff members from step 1 data
  const staffMembers: StaffMember[] = useMemo(() => {
    return state.step1Data?.staff || [];
  }, [state.step1Data?.staff]);

  // Check if we have staff members - if not, show error
  if (staffMembers.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="w-6 h-6 text-red-600" />
            <h2 className="text-lg font-semibold text-gray-900">Setup Error</h2>
          </div>
          <p className="text-gray-600 mb-6">No staff members found. Please complete Step 1 first.</p>
          
          {/* Debug Information */}
          <div className="mb-6 p-4 bg-gray-100 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Debug Information:</h3>
            <div className="text-xs text-gray-600 space-y-1">
              <p><strong>Navigation State:</strong> {location.state ? 'Present' : 'None'}</p>
              <p><strong>State Data:</strong> {JSON.stringify(state, null, 2)}</p>
              <p><strong>Staff Members:</strong> {JSON.stringify(staffMembers, null, 2)}</p>
              <p><strong>localStorage Data:</strong> {localStorage.getItem('onboarding_data') || 'None'}</p>
            </div>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/onboarding/step-1')}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Go to Step 1
            </button>
            <button
              onClick={() => {
                // Set up mock data for testing
                const mockData = {
                  step1Data: {
                    name: "Test Business",
                    slug: "test-business",
                    staff: [
                      {
                        id: "staff-1",
                        name: "John Doe",
                        role: "Hair Stylist",
                        email: "john@test.com",
                        phone: "555-1234",
                        color: "#3b82f6"
                      }
                    ]
                  }
                };
                localStorage.setItem('onboarding_data', JSON.stringify(mockData));
                window.location.reload();
              }}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 transition-colors"
            >
              Setup Test Data
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Memoized error handlers to prevent infinite re-renders
  const handleCalendarError = useCallback((error: Error) => {
    setError(error.message);
    onboardingStep4Observability.trackValidationError({
      error_type: 'calendar_error',
      message: error.message,
      field: 'availability_calendar',
    });
  }, []);

  const handleValidationChange = useCallback((isValid: boolean, errors: string[]) => {
    if (!isValid && errors.length > 0) {
      onboardingStep4Observability.trackValidationError({
        error_type: 'validation_failed',
        message: errors.join(', '),
        field: 'time_blocks',
      });
    }
  }, []);

  // Initialize availability calendar hook
  const {
    timeBlocks,
    staffAvailability,
    addTimeBlock,
    updateTimeBlock,
    deleteTimeBlock,
    copyWeek,
    validationResult,
    validateTimeBlocks,
    isLoading: calendarLoading,
    isSaving,
    error: calendarError,
    getTotalHoursForAllStaff,
  } = useAvailabilityCalendar({
    staffMembers,
    onError: handleCalendarError,
    onValidationChange: handleValidationChange,
  });

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setIsLoading(true);

        // Track step started
        onboardingStep4Observability.trackStepStarted({
          has_step1_data: !!state.step1Data,
          has_step2_data: !!state.step2Data,
          has_step3_data: !!state.step3Data,
          staff_count: staffMembers.length,
        });

        // Validate we have required data
        if (!staffMembers.length) {
          throw new Error('No staff members found. Please complete Step 1 first.');
        }

      } catch (err) {
        const error = err as Error;
        setError(error.message);
        onboardingStep4Observability.trackValidationError({
          error_type: 'initialization_error',
          message: error.message,
          field: 'step4_initialization',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, [state, staffMembers.length]);

  // Handle time block operations
  const handleTimeBlockAdd = async (timeBlock: TimeBlock) => {
    try {
      await addTimeBlock(timeBlock);
    } catch (error) {
      setError((error as Error).message);
    }
  };

  const handleTimeBlockUpdate = async (id: string, updates: Partial<TimeBlock>) => {
    try {
      await updateTimeBlock(id, updates);
    } catch (error) {
      setError((error as Error).message);
    }
  };

  const handleTimeBlockDelete = async (id: string) => {
    try {
      await deleteTimeBlock(id);
    } catch (error) {
      setError((error as Error).message);
    }
  };

  const handleCopyWeek = async (sourceWeekStart: Date, targetWeekStart: Date) => {
    try {
      await copyWeek(sourceWeekStart, targetWeekStart);
    } catch (error) {
      setError((error as Error).message);
    }
  };

  // Navigation handlers
  const handleBack = () => {
    navigate('/onboarding/services', {
      state: {
        ...state,
        step4Data: {
          timeBlocks,
          staffAvailability,
        },
      },
    });
  };

  const handleNext = async () => {
    try {
      // Validate time blocks
      const isValid = await validateTimeBlocks();
      if (!isValid) {
        setError('Please fix validation errors before proceeding.');
        return;
      }

      // Track step completion
      onboardingStep4Observability.trackStepCompleted({
        tenant_id: state.step1Data?.slug || 'unknown',
        total_rules: timeBlocks.length,
        staff_with_availability: staffAvailability.filter(staff => staff.time_blocks.length > 0).length,
        total_hours_per_week: getTotalHoursForAllStaff(),
        has_recurring_rules: timeBlocks.some(block => block.is_recurring),
      });

      // Navigate to next step
      navigate('/onboarding/step-5', {
        state: {
          ...state,
          step4Data: {
            timeBlocks,
            staffAvailability,
          },
        },
      });
    } catch (error) {
      setError((error as Error).message);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading availability setup...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="w-6 h-6 text-red-600" />
            <h2 className="text-lg font-semibold text-gray-900">Setup Error</h2>
          </div>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="flex gap-3">
            <button
              onClick={handleBack}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Go Back
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const totalHours = getTotalHoursForAllStaff();
  const staffWithAvailability = staffAvailability.filter(staff => staff.time_blocks.length > 0).length;
  const hasValidationErrors = validationResult && !validationResult.isValid;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Progress Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-500">
                  Step 4 of 8
                </div>
                <div className="w-32 bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: '50%' }} />
                </div>
              </div>
              
              {/* Progress Summary */}
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span className="text-sm text-gray-600">{staffMembers.length} Staff</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-gray-600">{staffWithAvailability} Available</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-purple-600" />
                  <span className="text-sm text-gray-600">{totalHours.toFixed(1)}h/week</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Validation Errors */}
      {hasValidationErrors && (
        <div className="bg-red-50 border-b border-red-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-red-800 mb-2">
                  Please fix the following issues:
                </h3>
                <ul className="text-sm text-red-700 space-y-1">
                  {validationResult?.errors.map((error, index) => (
                    <li key={index}>• {error.message}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Visual Calendar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <WorkingGridCalendar
            staffMembers={staffMembers}
            timeBlocks={timeBlocks}
            onTimeBlockAdd={handleTimeBlockAdd}
            onTimeBlockUpdate={handleTimeBlockUpdate}
            onTimeBlockDelete={handleTimeBlockDelete}
            onCopyWeek={handleCopyWeek}
            onError={(error) => setError(error.message)}
            className=""
          />
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={handleBack}
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Services
            </button>

            <div className="flex items-center gap-4">
              {isSaving && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  Saving...
                </div>
              )}
              
              <button
                onClick={handleNext}
                disabled={isSaving || hasValidationErrors}
                className="flex items-center gap-2 px-6 py-3 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Continue to Policies
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
