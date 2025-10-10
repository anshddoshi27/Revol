/**
 * Step7GiftCards Page
 * 
 * Seventh step of the onboarding wizard - Gift Cards Setup.
 * This page allows business owners to configure gift cards or skip the feature.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GiftCardSetup } from '../../components/onboarding/GiftCardSetup';
import { telemetry } from '../../services/telemetry';
import type { GiftCardConfig } from '../../api/types/giftCards';

export const Step7GiftCards: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [stepData, setStepData] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>('');

  // Load step data on mount
  useEffect(() => {
    // Get prefill data from navigation state
    if (location.state?.step6Data) {
      setStepData(location.state.step6Data);
    }

    // Emit analytics event
    telemetry.track('onboarding.step7_started', {
      has_step6_data: !!location.state?.step6Data,
    });
  }, [location.state]);

  // Handle gift card configuration save
  const handleGiftCardSave = useCallback(async (config: GiftCardConfig) => {
    try {
      setIsSubmitting(true);
      setError('');

      // Emit analytics event
      telemetry.track('onboarding.step7_complete', {
        has_gift_cards: config.is_enabled,
        denominations_count: config.denominations.length,
        expiration_policy: config.expiration_policy,
        tenant_id: config.tenant_id,
      });

      // Navigate to next step with form data
      navigate('/onboarding/payments', {
        state: {
          ...stepData,
          step7Data: {
            giftCardConfig: config,
          },
        },
      });
    } catch (error) {
      console.error('Failed to proceed to next step:', error);
      setError(error instanceof Error ? error.message : 'Failed to save gift card configuration');
    } finally {
      setIsSubmitting(false);
    }
  }, [navigate, stepData]);

  // Handle skip gift cards
  const handleSkipGiftCards = useCallback(async () => {
    try {
      setIsSubmitting(true);
      setError('');

      // Emit analytics event
      telemetry.track('onboarding.step7_skip', {
        tenant_id: stepData?.step1Data?.slug || 'unknown',
      });

      // Navigate to next step without gift card configuration
      navigate('/onboarding/payments', {
        state: {
          ...stepData,
          step7Data: {
            giftCardConfig: {
              is_enabled: false,
              denominations: [],
              expiration_policy: '1 year from purchase',
            },
          },
        },
      });
    } catch (error) {
      console.error('Failed to proceed to next step:', error);
      setError(error instanceof Error ? error.message : 'Failed to proceed to next step');
    } finally {
      setIsSubmitting(false);
    }
  }, [navigate, stepData]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    navigate('/onboarding/policies', {
      state: {
        step6Data: stepData,
      },
    });
  }, [navigate, stepData]);

  // Loading state
  if (isSubmitting) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Saving gift card configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Gift Cards
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                  Set up gift cards for your customers (optional)
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-sm text-gray-500">
                  Step 7 of 8
                </div>
                <div className="w-32 bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: '87.5%' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Error
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Gift Card Setup Component */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-8">
            <GiftCardSetup
              onSave={handleGiftCardSave}
              onSkip={handleSkipGiftCards}
              initialConfig={stepData?.giftCardConfig}
            />
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-6">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            disabled={isSubmitting}
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back
          </button>

          <div className="text-sm text-gray-500">
            Gift cards are optional and can be configured later in your admin dashboard
          </div>
        </div>
      </div>
    </div>
  );
};

