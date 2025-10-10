/**
 * Step8Payments Page
 * 
 * Final step of the onboarding wizard - Payments, Wallets & Subscription (GO LIVE).
 * This page handles payment setup, wallet configuration, KYC verification, and go-live functionality.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { PaymentSetup } from '../../components/onboarding/PaymentSetup';
import { WalletToggles } from '../../components/onboarding/WalletToggles';
import { KYCForm } from '../../components/onboarding/KYCForm';
import { GoLiveModal } from '../../components/onboarding/GoLiveModal';
import { GoLiveSuccess } from '../../components/onboarding/GoLiveSuccess';
import { usePaymentSetup } from '../../hooks/usePaymentSetup';
import { useKYCForm } from '../../hooks/useKYCForm';
import { telemetry } from '../../services/telemetry';
import type { 
  StripeSetupIntent,
  WalletConfig,
  KYCFormData,
  GoLiveFormData,
  GoLiveData 
} from '../../api/types/payments';

export const Step8Payments: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // State
  const [stepData, setStepData] = useState<any>(null);
  const [currentStep, setCurrentStep] = useState<'payment' | 'wallets' | 'kyc' | 'go-live' | 'success'>('payment');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>('');
  const [goLiveData, setGoLiveData] = useState<GoLiveData | null>(null);
  const [showGoLiveModal, setShowGoLiveModal] = useState(false);

  // Get tenant ID from step data
  const tenantId = stepData?.step1Data?.slug || 'unknown';

  // Hooks
  const paymentSetup = usePaymentSetup({
    tenantId,
    onError: setError,
    onSuccess: (data) => {
      console.log('Payment setup success:', data);
    }
  });

  const kycForm = useKYCForm({
    tenantId,
    onError: setError,
    onSuccess: (data) => {
      console.log('KYC form success:', data);
    }
  });

  // Load step data on mount
  useEffect(() => {
    if (location.state?.step7Data) {
      setStepData(location.state);
    }

    // Emit analytics event
    telemetry.track('onboarding.step8_started', {
      has_step7_data: !!location.state?.step7Data,
      tenant_id: tenantId,
    });
  }, [location.state, tenantId]);

  // Handle payment setup completion
  const handlePaymentSetupComplete = useCallback(async (setupIntent: StripeSetupIntent) => {
    try {
      setIsSubmitting(true);
      setError('');

      // Confirm the setup intent
      const success = await paymentSetup.confirmSetupIntent(setupIntent.id, setupIntent.payment_method || '');
      
      if (success) {
        // Emit analytics event
        telemetry.track('onboarding.step8_payment_complete', {
          tenant_id: tenantId,
          setup_intent_id: setupIntent.id,
        });

        // Move to next step
        setCurrentStep('wallets');
      }
    } catch (error: any) {
      console.error('Payment setup failed:', error);
      setError(error.message || 'Payment setup failed');
    } finally {
      setIsSubmitting(false);
    }
  }, [paymentSetup, tenantId]);

  // Handle wallet configuration
  const handleWalletConfigChange = useCallback(async (config: WalletConfig) => {
    try {
      setIsSubmitting(true);
      setError('');

      // Update wallet configuration
      const success = await paymentSetup.updateWalletConfig({
        cards: config.cards,
        apple_pay: config.apple_pay,
        google_pay: config.google_pay,
        paypal: config.paypal,
        cash: config.cash,
      });

      if (success) {
        // Emit analytics event
        telemetry.track('onboarding.step8_wallets_complete', {
          tenant_id: tenantId,
          wallets: config,
        });

        // Move to next step
        setCurrentStep('kyc');
      }
    } catch (error: any) {
      console.error('Wallet configuration failed:', error);
      setError(error.message || 'Wallet configuration failed');
    } finally {
      setIsSubmitting(false);
    }
  }, [paymentSetup, tenantId]);

  // Handle KYC form change
  const handleKYCFormChange = useCallback(async (data: KYCFormData) => {
    try {
      // Validate the form
      if (kycForm.validateForm()) {
        setIsSubmitting(true);
        setError('');

        // Create or update KYC data
        const success = await paymentSetup.createKYC(data);

        if (success) {
          // Emit analytics event
          telemetry.track('onboarding.step8_kyc_complete', {
            tenant_id: tenantId,
            business_type: data.business_type,
            has_tax_id: !!data.tax_id,
          });

          // Move to go-live step
          setCurrentStep('go-live');
        }
      }
    } catch (error: any) {
      console.error('KYC submission failed:', error);
      setError(error.message || 'Business verification failed');
    } finally {
      setIsSubmitting(false);
    }
  }, [paymentSetup, kycForm, tenantId]);

  // Handle go-live confirmation
  const handleGoLiveConfirm = useCallback(async (data: GoLiveFormData) => {
    try {
      setIsSubmitting(true);
      setError('');

      // Go live
      const success = await paymentSetup.goLive(data);

      if (success) {
        // Emit analytics event
        telemetry.track('onboarding.step8_complete', {
          tenant_id: tenantId,
          business_name: stepData?.step1Data?.name || 'Unknown',
        });

        // Set go-live data and show success screen
        setGoLiveData(paymentSetup.goLiveData);
        setCurrentStep('success');
        setShowGoLiveModal(false);
      }
    } catch (error: any) {
      console.error('Go live failed:', error);
      setError(error.message || 'Failed to go live');
    } finally {
      setIsSubmitting(false);
    }
  }, [paymentSetup, tenantId, stepData]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    switch (currentStep) {
      case 'wallets':
        setCurrentStep('payment');
        break;
      case 'kyc':
        setCurrentStep('wallets');
        break;
      case 'go-live':
        setCurrentStep('kyc');
        break;
      default:
        navigate('/onboarding/gift-cards', {
          state: { step7Data: stepData },
        });
    }
  }, [currentStep, navigate, stepData]);

  // Handle skip to go-live (for testing)
  const handleSkipToGoLive = useCallback(() => {
    setCurrentStep('go-live');
  }, []);

  // Loading state
  if (isSubmitting) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Processing...</p>
        </div>
      </div>
    );
  }

  // Success screen
  if (currentStep === 'success' && goLiveData) {
    return <GoLiveSuccess goLiveData={goLiveData} tenantId={tenantId} />;
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
                  {currentStep === 'payment' && 'Payment Setup'}
                  {currentStep === 'wallets' && 'Payment Methods'}
                  {currentStep === 'kyc' && 'Business Verification'}
                  {currentStep === 'go-live' && 'Go Live'}
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                  {currentStep === 'payment' && 'Set up your subscription payment method'}
                  {currentStep === 'wallets' && 'Choose which payment methods to accept'}
                  {currentStep === 'kyc' && 'Verify your business identity for compliance'}
                  {currentStep === 'go-live' && 'Make your business live and start accepting bookings'}
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-sm text-gray-500">
                  Step 8 of 8
                </div>
                <div className="w-32 bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: '100%' }} />
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

        {/* Step Content */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-8">
            {currentStep === 'payment' && (
              <PaymentSetup
                tenantId={tenantId}
                onSetupComplete={handlePaymentSetupComplete}
                onError={setError}
              />
            )}

            {currentStep === 'wallets' && (
              <WalletToggles
                tenantId={tenantId}
                onConfigChange={handleWalletConfigChange}
                onError={setError}
                initialConfig={paymentSetup.walletConfig}
              />
            )}

            {currentStep === 'kyc' && (
              <KYCForm
                tenantId={tenantId}
                onFormChange={handleKYCFormChange}
                onError={setError}
                initialData={kycForm.formData}
              />
            )}

            {currentStep === 'go-live' && (
              <div className="text-center space-y-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Ready to Go Live!
                  </h2>
                  <p className="text-gray-600">
                    Your business is fully configured and ready to accept bookings.
                  </p>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                  <h3 className="text-lg font-medium text-green-900 mb-4">
                    What happens when you go live?
                  </h3>
                  <ul className="text-left text-green-800 space-y-2">
                    <li className="flex items-center">
                      <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Your booking site becomes publicly accessible
                    </li>
                    <li className="flex items-center">
                      <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Customers can start booking appointments
                    </li>
                    <li className="flex items-center">
                      <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Your subscription billing begins
                    </li>
                    <li className="flex items-center">
                      <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      You can make changes anytime in your admin dashboard
                    </li>
                  </ul>
                </div>

                <button
                  onClick={() => setShowGoLiveModal(true)}
                  className="w-full px-6 py-3 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  Go Live Now!
                </button>
              </div>
            )}
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
            {currentStep === 'payment' && 'Payment setup is required to proceed'}
            {currentStep === 'wallets' && 'Choose your preferred payment methods'}
            {currentStep === 'kyc' && 'Business verification is required for compliance'}
            {currentStep === 'go-live' && 'Final step - make your business live!'}
          </div>
        </div>
      </div>

      {/* Go Live Modal */}
      <GoLiveModal
        isOpen={showGoLiveModal}
        onClose={() => setShowGoLiveModal(false)}
        onConfirm={handleGoLiveConfirm}
        businessName={stepData?.step1Data?.name || 'Your Business'}
        tenantId={tenantId}
      />
    </div>
  );
};

