/**
 * PaymentSetup Component
 * 
 * Component for setting up Stripe payment methods for subscription billing.
 * Handles Stripe Elements integration and setup intent confirmation.
 */

import React, { useState, useEffect } from 'react';
import { loadStripe, Stripe, StripeElements, StripeCardElement } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { config } from '../../lib/env';
import { paymentService } from '../../api/services/payments';
import { telemetry } from '../../services/telemetry';
import type { 
  PaymentSetupFormData, 
  PaymentValidationErrors,
  CreatePaymentSetupRequest,
  StripeSetupIntent 
} from '../../api/types/payments';

// Initialize Stripe
const stripePromise = loadStripe(config.STRIPE_PUBLISHABLE_KEY);

interface PaymentSetupProps {
  tenantId: string;
  onSetupComplete: (setupIntent: StripeSetupIntent) => void;
  onError: (error: string) => void;
  initialData?: Partial<PaymentSetupFormData>;
}

interface PaymentFormProps {
  tenantId: string;
  onSetupComplete: (setupIntent: StripeSetupIntent) => void;
  onError: (error: string) => void;
  initialData?: Partial<PaymentSetupFormData>;
}

const PaymentForm: React.FC<PaymentFormProps> = ({
  tenantId,
  onSetupComplete,
  onError,
  initialData
}) => {
  const stripe = useStripe();
  const elements = useElements();
  
  const [formData, setFormData] = useState<PaymentSetupFormData>({
    subscription_consent: false,
    terms_consent: false,
    privacy_consent: false,
    ...initialData
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingSetupIntent, setIsCreatingSetupIntent] = useState(false);
  const [setupIntent, setSetupIntent] = useState<StripeSetupIntent | null>(null);
  const [errors, setErrors] = useState<PaymentValidationErrors>({});

  // Create setup intent on component mount
  useEffect(() => {
    createSetupIntent();
  }, []);

  const createSetupIntent = async () => {
    try {
      setIsCreatingSetupIntent(true);
      
      // Emit analytics event
      telemetry.track('payments.setup_intent_started', {
        tenant_id: tenantId,
      });

      const request: CreatePaymentSetupRequest = {
        tenant_id: tenantId,
        subscription_amount_cents: 1199, // $11.99
        currency: 'USD',
      };

      const response = await paymentService.createSetupIntent(request);
      setSetupIntent(response.setup_intent);

      // Emit analytics event
      telemetry.track('payments.setup_intent_created', {
        tenant_id: tenantId,
        setup_intent_id: response.setup_intent.id,
        status: response.setup_intent.status,
      });

    } catch (error: any) {
      console.error('Failed to create setup intent:', error);
      onError(error.message || 'Failed to create payment setup');
      
      // Emit analytics event
      telemetry.track('payments.setup_intent_failed', {
        tenant_id: tenantId,
        error: error.message,
      });
    } finally {
      setIsCreatingSetupIntent(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: PaymentValidationErrors = {};

    if (!formData.subscription_consent) {
      newErrors.subscription_consent = 'You must agree to the subscription terms';
    }

    if (!formData.terms_consent) {
      newErrors.terms_consent = 'You must agree to the terms of service';
    }

    if (!formData.privacy_consent) {
      newErrors.privacy_consent = 'You must agree to the privacy policy';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements || !setupIntent) {
      onError('Payment system not ready. Please try again.');
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      // Get the card element
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error('Card element not found');
      }

      // Confirm the setup intent
      const { error, setupIntent: confirmedSetupIntent } = await stripe.confirmCardSetup(
        setupIntent.client_secret,
        {
          payment_method: {
            card: cardElement,
            billing_details: {
              name: 'Business Owner', // This should come from user context
            },
          },
        }
      );

      if (error) {
        throw new Error(error.message || 'Payment setup failed');
      }

      if (!confirmedSetupIntent) {
        throw new Error('Setup intent confirmation failed');
      }

      // Emit analytics event
      telemetry.track('payments.setup_intent_succeeded', {
        tenant_id: tenantId,
        setup_intent_id: confirmedSetupIntent.id,
        status: confirmedSetupIntent.status,
      });

      onSetupComplete(confirmedSetupIntent);

    } catch (error: any) {
      console.error('Payment setup failed:', error);
      onError(error.message || 'Payment setup failed');
      
      // Emit analytics event
      telemetry.track('payments.setup_intent_failed', {
        tenant_id: tenantId,
        error: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFieldChange = (field: keyof PaymentSetupFormData, value: boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#424770',
        '::placeholder': {
          color: '#aab7c4',
        },
      },
      invalid: {
        color: '#9e2146',
      },
    },
  };

  if (isCreatingSetupIntent) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Setting up payment system...</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Subscription Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">
              Subscription Plan
            </h3>
            <div className="mt-2 text-sm text-blue-700">
              <p>You'll be charged <strong>$11.99/month</strong> for your Tithi subscription.</p>
              <p className="mt-1">This includes all features: booking management, customer notifications, analytics, and more.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Card Information */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Card Information
        </label>
        <div className="border border-gray-300 rounded-md p-3 bg-white">
          <CardElement options={cardElementOptions} />
        </div>
        <p className="mt-2 text-sm text-gray-500">
          Your card will be securely processed by Stripe. We don't store your card details.
        </p>
      </div>

      {/* Consent Checkboxes */}
      <div className="space-y-4">
        <div className="flex items-start">
          <div className="flex items-center h-5">
            <input
              id="subscription_consent"
              type="checkbox"
              checked={formData.subscription_consent}
              onChange={(e) => handleFieldChange('subscription_consent', e.target.checked)}
              className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
            />
          </div>
          <div className="ml-3 text-sm">
            <label htmlFor="subscription_consent" className="font-medium text-gray-700">
              I agree to the $11.99/month subscription
            </label>
            {errors.subscription_consent && (
              <p className="mt-1 text-red-600">{errors.subscription_consent}</p>
            )}
          </div>
        </div>

        <div className="flex items-start">
          <div className="flex items-center h-5">
            <input
              id="terms_consent"
              type="checkbox"
              checked={formData.terms_consent}
              onChange={(e) => handleFieldChange('terms_consent', e.target.checked)}
              className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
            />
          </div>
          <div className="ml-3 text-sm">
            <label htmlFor="terms_consent" className="font-medium text-gray-700">
              I agree to the{' '}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-500">
                Terms of Service
              </a>
            </label>
            {errors.terms_consent && (
              <p className="mt-1 text-red-600">{errors.terms_consent}</p>
            )}
          </div>
        </div>

        <div className="flex items-start">
          <div className="flex items-center h-5">
            <input
              id="privacy_consent"
              type="checkbox"
              checked={formData.privacy_consent}
              onChange={(e) => handleFieldChange('privacy_consent', e.target.checked)}
              className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
            />
          </div>
          <div className="ml-3 text-sm">
            <label htmlFor="privacy_consent" className="font-medium text-gray-700">
              I agree to the{' '}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-500">
                Privacy Policy
              </a>
            </label>
            {errors.privacy_consent && (
              <p className="mt-1 text-red-600">{errors.privacy_consent}</p>
            )}
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <div className="pt-4">
        <button
          type="submit"
          disabled={isLoading || !stripe || !elements}
          className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Setting up payment...
            </>
          ) : (
            'Setup Payment Method'
          )}
        </button>
      </div>
    </form>
  );
};

export const PaymentSetup: React.FC<PaymentSetupProps> = ({
  tenantId,
  onSetupComplete,
  onError,
  initialData
}) => {
  return (
    <Elements stripe={stripePromise}>
      <PaymentForm
        tenantId={tenantId}
        onSetupComplete={onSetupComplete}
        onError={onError}
        initialData={initialData}
      />
    </Elements>
  );
};

