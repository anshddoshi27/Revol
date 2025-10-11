/**
 * Step6Policies Page
 * 
 * Sixth step of the onboarding wizard - Booking Policies & Confirmation Message.
 * This page allows business owners to set up policies and confirmation messages.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePolicyManagement } from '../../hooks/usePolicyManagement';
import { useConfirmationMessage } from '../../hooks/useConfirmationMessage';
import { telemetry } from '../../services/telemetry';
import { PolicyEditor } from '../../components/onboarding/PolicyEditor';
import { ConfirmationMessageEditor } from '../../components/onboarding/ConfirmationMessageEditor';
import { CheckoutWarningConfig } from '../../components/onboarding/CheckoutWarningConfig';
import type { 
  BookingPolicyFormData,
  ConfirmationMessageFormData,
  CheckoutWarningFormData,
  ServiceDetails,
  AvailabilityDetails,
  BusinessDetails,
} from '../../api/types/policies';

export const Step6Policies: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [stepData, setStepData] = useState<any>(null);

  // State for UI
  const [currentSection, setCurrentSection] = useState<'policies' | 'message' | 'warning'>('policies');
  const [isEditingPolicy, setIsEditingPolicy] = useState(false);
  const [isEditingMessage, setIsEditingMessage] = useState(false);
  const [isEditingWarning, setIsEditingWarning] = useState(false);

  // Policy management hook
  const {
    policy,
    isLoading: isPolicyLoading,
    isSubmitting: isPolicySubmitting,
    errors: policyErrors,
    validationErrors: policyValidationErrors,
    createOrUpdatePolicy,
    loadPolicy,
    clearErrors: clearPolicyErrors,
  } = usePolicyManagement({
    onPolicyCreated: (policy) => {
      console.log('Policy created:', policy);
      // Emit analytics event
      // telemetry.track('policies.save_success', {
      //   policy_id: policy.id,
      //   has_cancellation_cutoff: policy.cancellation_cutoff_hours > 0,
      //   has_no_show_fee: policy.no_show_fee_percent > 0,
      // });
    },
    onError: (error) => {
      console.error('Policy error:', error);
      // Emit analytics event
      // telemetry.track('policies.save_error', {
      //   error_code: error.error_code,
      //   error_message: error.message,
      // });
    },
  });

  // Confirmation message management hook
  const {
    message,
    isLoading: isMessageLoading,
    isSubmitting: isMessageSubmitting,
    errors: messageErrors,
    validationErrors: messageValidationErrors,
    createOrUpdateMessage,
    loadMessage,
    clearErrors: clearMessageErrors,
    previewMessage,
  } = useConfirmationMessage({
    onMessageCreated: (message) => {
      console.log('Confirmation message created:', message);
      // Emit analytics event
      // telemetry.track('confirmation_message.save_success', {
      //   message_id: message.id,
      //   content_length: message.content.length,
      // });
    },
    onError: (error) => {
      console.error('Confirmation message error:', error);
      // Emit analytics event
      // telemetry.track('confirmation_message.save_error', {
      //   error_code: error.error_code,
      //   error_message: error.message,
      // });
    },
  });

  // Load step data and existing policies on mount
  useEffect(() => {
    // Get prefill data from navigation state
    if (location.state?.step5Data) {
      setStepData(location.state.step5Data);
    }

    // Load existing policies and messages
    loadPolicy();
    loadMessage();

    // Emit analytics event
    telemetry.trackOnboardingStep(6, 'started', {
      has_step5_data: !!location.state?.step5Data,
    });
  }, [location.state, loadPolicy, loadMessage]);

  // Handle policy save
  const handlePolicySave = useCallback(async (policyData: BookingPolicyFormData): Promise<boolean> => {
    const result = await createOrUpdatePolicy(policyData);
    if (result) {
      setIsEditingPolicy(false);
      return true;
    }
    return false;
  }, [createOrUpdatePolicy]);

  // Handle confirmation message save
  const handleMessageSave = useCallback(async (messageData: ConfirmationMessageFormData): Promise<boolean> => {
    const result = await createOrUpdateMessage(messageData);
    if (result) {
      setIsEditingMessage(false);
      return true;
    }
    return false;
  }, [createOrUpdateMessage]);

  // Handle checkout warning save (placeholder - would need similar hook)
  const handleWarningSave = useCallback(async (warningData: CheckoutWarningFormData): Promise<boolean> => {
    // TODO: Implement checkout warning management hook
    console.log('Warning save:', warningData);
    setIsEditingWarning(false);
    return true;
  }, []);

  // Handle continue to next step
  const handleContinue = useCallback(() => {
    // Validate that required policies and messages are set
    if (!policy) {
      alert('Please set up your booking policies before continuing.');
      return;
    }

    if (!message) {
      alert('Please create a confirmation message before continuing.');
      return;
    }

    // Emit analytics event
    telemetry.trackOnboardingStep(6, 'complete', {
      has_policy: !!policy,
      has_confirmation_message: !!message,
      policy_active: policy?.is_active,
      message_active: message?.is_active,
    });

    // Navigate to next step with form data
    navigate('/onboarding/gift-cards', {
      state: {
        step6Data: {
          policy,
          message,
        },
        ...stepData,
      },
    });
  }, [navigate, policy, message, stepData]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    navigate('/onboarding/notifications', {
      state: {
        step5Data: stepData,
      },
    });
  }, [navigate, stepData]);

  // Get service details for quick paste (from step data)
  const serviceDetails: ServiceDetails | undefined = stepData?.services?.[0] ? {
    name: stepData.services[0].name,
    description: stepData.services[0].description,
    duration_minutes: stepData.services[0].duration_minutes,
    price_cents: stepData.services[0].price_cents,
    instructions: stepData.services[0].pre_appointment_instructions,
  } : undefined;

  // Get business details for quick paste (from step data)
  const businessDetails: BusinessDetails | undefined = stepData?.business ? {
    name: stepData.business.name,
    address: stepData.business.address,
    phone: stepData.business.phone,
    email: stepData.business.support_email,
  } : undefined;

  // Get availability details for quick paste (placeholder)
  const availabilityDetails: AvailabilityDetails | undefined = {
    date: 'Monday, January 15, 2024',
    time: '2:00 PM',
    timezone: 'America/New_York',
    duration_minutes: 60,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Policies & Confirmation
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                  Set up your booking policies and confirmation messages
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-sm text-gray-500">
                  Step 6 of 8
                </div>
                <div className="w-32 bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: '75%' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isEditingPolicy ? (
          /* Policy Editor */
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4">
              <PolicyEditor
                policy={policy}
                onSave={handlePolicySave}
                onCancel={() => {
                  setIsEditingPolicy(false);
                  clearPolicyErrors();
                }}
                isSubmitting={isPolicySubmitting}
                errors={policyErrors}
                validationErrors={policyValidationErrors}
              />
            </div>
          </div>
        ) : isEditingMessage ? (
          /* Confirmation Message Editor */
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4">
              <ConfirmationMessageEditor
                message={message}
                onSave={handleMessageSave}
                onCancel={() => {
                  setIsEditingMessage(false);
                  clearMessageErrors();
                }}
                onPreview={previewMessage}
                isSubmitting={isMessageSubmitting}
                errors={messageErrors}
                validationErrors={messageValidationErrors}
                serviceDetails={serviceDetails}
                availabilityDetails={availabilityDetails}
                businessDetails={businessDetails}
              />
            </div>
          </div>
        ) : isEditingWarning ? (
          /* Checkout Warning Config */
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4">
              <CheckoutWarningConfig
                onSave={handleWarningSave}
                onCancel={() => {
                  setIsEditingWarning(false);
                }}
                isSubmitting={false}
                errors={{}}
                validationErrors={[]}
              />
            </div>
          </div>
        ) : (
          /* Main Dashboard */
          <div className="space-y-6">
            {/* Section Navigation */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4">
                <nav className="flex space-x-8">
                  <button
                    type="button"
                    onClick={() => setCurrentSection('policies')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      currentSection === 'policies'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Booking Policies
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentSection('message')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      currentSection === 'message'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Confirmation Message
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentSection('warning')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      currentSection === 'warning'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Checkout Warning
                  </button>
                </nav>
              </div>
            </div>

            {/* Policies Section */}
            {currentSection === 'policies' && (
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-lg font-medium text-gray-900">
                        Booking Policies
                      </h2>
                      <p className="mt-1 text-sm text-gray-500">
                        Set up cancellation, no-show, refund, and payment policies
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsEditingPolicy(true)}
                      className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      {policy ? 'Edit Policies' : 'Create Policies'}
                    </button>
                  </div>

                  {isPolicyLoading ? (
                    <div className="text-center py-8">
                      <svg className="animate-spin mx-auto h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <p className="mt-2 text-sm text-gray-500">Loading policies...</p>
                    </div>
                  ) : policy ? (
                    <div className="space-y-4">
                      <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                        <h3 className="font-medium text-gray-900 mb-2">Current Policies</h3>
                        <div className="space-y-2 text-sm text-gray-600">
                          <div>
                            <span className="font-medium">Cancellation:</span> {policy.cancellation_cutoff_hours} hours notice required
                          </div>
                          <div>
                            <span className="font-medium">No-Show Fee:</span> {policy.no_show_fee_percent}%
                            {policy.no_show_fee_flat_cents && ` or $${(policy.no_show_fee_flat_cents / 100).toFixed(2)}`}
                          </div>
                          <div>
                            <span className="font-medium">Refund Policy:</span> {policy.refund_policy}
                          </div>
                          <div>
                            <span className="font-medium">Cash Payment:</span> {policy.cash_logistics}
                          </div>
                          <div>
                            <span className="font-medium">Status:</span> 
                            <span className={`ml-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              policy.is_active 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {policy.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <h3 className="mt-2 text-sm font-medium text-gray-900">No policies set</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Create your booking policies to protect your business and set customer expectations.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Confirmation Message Section */}
            {currentSection === 'message' && (
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-lg font-medium text-gray-900">
                        Confirmation Message
                      </h2>
                      <p className="mt-1 text-sm text-gray-500">
                        Create the message customers see when they complete their booking
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsEditingMessage(true)}
                      className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      {message ? 'Edit Message' : 'Create Message'}
                    </button>
                  </div>

                  {isMessageLoading ? (
                    <div className="text-center py-8">
                      <svg className="animate-spin mx-auto h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <p className="mt-2 text-sm text-gray-500">Loading message...</p>
                    </div>
                  ) : message ? (
                    <div className="space-y-4">
                      <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                        <h3 className="font-medium text-gray-900 mb-2">Current Message</h3>
                        <div className="text-sm text-gray-600 whitespace-pre-wrap">
                          {message.content}
                        </div>
                        <div className="mt-2">
                          <span className="font-medium">Status:</span>
                          <span className={`ml-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            message.is_active 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {message.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <h3 className="mt-2 text-sm font-medium text-gray-900">No confirmation message</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Create a confirmation message to send to customers after they book.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Checkout Warning Section */}
            {currentSection === 'warning' && (
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-lg font-medium text-gray-900">
                        Checkout Warning
                      </h2>
                      <p className="mt-1 text-sm text-gray-500">
                        Configure warnings and acknowledgments shown during checkout
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsEditingWarning(true)}
                      className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Configure Warning
                    </button>
                  </div>

                  <div className="text-center py-8">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No checkout warning configured</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Set up a warning message to show customers important information during checkout.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between pt-6">
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back
              </button>

              <button
                type="button"
                onClick={handleContinue}
                disabled={!policy || !message}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
