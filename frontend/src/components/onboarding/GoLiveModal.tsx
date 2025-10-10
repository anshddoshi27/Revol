/**
 * GoLiveModal Component
 * 
 * Modal component for confirming the go-live action with final consent checkboxes.
 * Ensures business owners understand the implications of going live.
 */

import React, { useState } from 'react';
import { telemetry } from '../../services/telemetry';
import type { GoLiveFormData, GoLiveValidationErrors } from '../../api/types/payments';

interface GoLiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: GoLiveFormData) => void;
  businessName: string;
  tenantId: string;
}

export const GoLiveModal: React.FC<GoLiveModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  businessName,
  tenantId
}) => {
  const [formData, setFormData] = useState<GoLiveFormData>({
    consent_terms: false,
    consent_privacy: false,
    consent_subscription: false,
    confirm_go_live: false,
  });

  const [errors, setErrors] = useState<GoLiveValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: GoLiveValidationErrors = {};

    if (!formData.consent_terms) {
      newErrors.consent_terms = 'You must agree to the terms of service';
    }

    if (!formData.consent_privacy) {
      newErrors.consent_privacy = 'You must agree to the privacy policy';
    }

    if (!formData.consent_subscription) {
      newErrors.consent_subscription = 'You must agree to the subscription terms';
    }

    if (!formData.confirm_go_live) {
      newErrors.confirm_go_live = 'You must confirm that you want to go live';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFieldChange = (field: keyof GoLiveFormData, value: boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user changes setting
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Emit analytics event
      telemetry.track('owner.go_live_confirmed', {
        tenant_id: tenantId,
        business_name: businessName,
      });

      await onConfirm(formData);
    } catch (error) {
      console.error('Go live confirmation failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={handleClose}
        />

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <form onSubmit={handleSubmit}>
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              {/* Header */}
              <div className="sm:flex sm:items-start">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-green-100 sm:mx-0 sm:h-10 sm:w-10">
                  <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Ready to Go Live?
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      You're about to make <strong>{businessName}</strong> live and start accepting bookings!
                    </p>
                  </div>
                </div>
              </div>

              {/* Important Information */}
              <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">
                      Important Information
                    </h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      <ul className="list-disc list-inside space-y-1">
                        <li>Your booking site will be publicly accessible</li>
                        <li>You'll start receiving real customer bookings</li>
                        <li>Your subscription billing will begin</li>
                        <li>You can make changes anytime in your admin dashboard</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Consent Checkboxes */}
              <div className="mt-6 space-y-4">
                <div className="flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      id="consent_terms"
                      type="checkbox"
                      checked={formData.consent_terms}
                      onChange={(e) => handleFieldChange('consent_terms', e.target.checked)}
                      className="focus:ring-green-500 h-4 w-4 text-green-600 border-gray-300 rounded"
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label htmlFor="consent_terms" className="font-medium text-gray-700">
                      I agree to the{' '}
                      <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-green-600 hover:text-green-500">
                        Terms of Service
                      </a>
                    </label>
                    {errors.consent_terms && (
                      <p className="mt-1 text-red-600">{errors.consent_terms}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      id="consent_privacy"
                      type="checkbox"
                      checked={formData.consent_privacy}
                      onChange={(e) => handleFieldChange('consent_privacy', e.target.checked)}
                      className="focus:ring-green-500 h-4 w-4 text-green-600 border-gray-300 rounded"
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label htmlFor="consent_privacy" className="font-medium text-gray-700">
                      I agree to the{' '}
                      <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-green-600 hover:text-green-500">
                        Privacy Policy
                      </a>
                    </label>
                    {errors.consent_privacy && (
                      <p className="mt-1 text-red-600">{errors.consent_privacy}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      id="consent_subscription"
                      type="checkbox"
                      checked={formData.consent_subscription}
                      onChange={(e) => handleFieldChange('consent_subscription', e.target.checked)}
                      className="focus:ring-green-500 h-4 w-4 text-green-600 border-gray-300 rounded"
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label htmlFor="consent_subscription" className="font-medium text-gray-700">
                      I understand that I will be charged $11.99/month for my subscription
                    </label>
                    {errors.consent_subscription && (
                      <p className="mt-1 text-red-600">{errors.consent_subscription}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      id="confirm_go_live"
                      type="checkbox"
                      checked={formData.confirm_go_live}
                      onChange={(e) => handleFieldChange('confirm_go_live', e.target.checked)}
                      className="focus:ring-green-500 h-4 w-4 text-green-600 border-gray-300 rounded"
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label htmlFor="confirm_go_live" className="font-medium text-gray-700">
                      I confirm that I want to make my business live and start accepting bookings
                    </label>
                    {errors.confirm_go_live && (
                      <p className="mt-1 text-red-600">{errors.confirm_go_live}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Going Live...
                  </>
                ) : (
                  'Go Live!'
                )}
              </button>
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

