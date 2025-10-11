/**
 * GiftCardSetup Component
 * 
 * Main component for setting up gift cards during onboarding.
 * Handles enable/disable toggle, denomination management, and configuration.
 */

import React, { useState, useCallback } from 'react';
import { useGiftCardSetup } from '../../hooks/useGiftCardSetup';
import { DenominationEditor } from './DenominationEditor';
import { GiftCardPreview } from './GiftCardPreview';
import { telemetry } from '../../services/telemetry';
import type { GiftCardConfig } from '../../api/types/giftCards';

interface GiftCardSetupProps {
  onSave: (config: GiftCardConfig) => void;
  onSkip: () => void;
  initialConfig?: GiftCardConfig | null;
}

export const GiftCardSetup: React.FC<GiftCardSetupProps> = ({
  onSave,
  onSkip,
  initialConfig,
}) => {
  const [showPreview, setShowPreview] = useState(false);

  const {
    config,
    isEnabled,
    denominations,
    expirationPolicy,
    isLoading,
    isSubmitting,
    errors,
    validationErrors,
    setEnabled,
    setExpirationPolicy,
    addDenomination,
    updateDenomination,
    removeDenomination,
    saveConfig,
    skipGiftCards,
    clearErrors,
    isValid,
    canProceed,
  } = useGiftCardSetup({
    onConfigCreated: (config) => {
      telemetry.track('onboarding.step7_complete', {
        has_gift_cards: config.is_enabled,
        denominations_count: config.denominations.length,
        expiration_policy: config.expiration_policy,
      });
      onSave(config);
    },
    onError: (error) => {
      console.error('Gift card setup error:', error);
    },
  });

  // Handle enable/disable toggle
  const handleToggleEnabled = useCallback((enabled: boolean) => {
    setEnabled(enabled);
    clearErrors();
  }, [setEnabled, clearErrors]);

  // Handle expiration policy change
  const handleExpirationPolicyChange = useCallback((policy: string) => {
    setExpirationPolicy(policy);
  }, [setExpirationPolicy]);

  // Handle denomination actions
  const handleAddDenomination = useCallback(async (amountCents: number) => {
    const success = await addDenomination(amountCents);
    if (success) {
      clearErrors();
    }
  }, [addDenomination, clearErrors]);

  const handleUpdateDenomination = useCallback(async (id: string, amountCents: number) => {
    const success = await updateDenomination(id, amountCents);
    if (success) {
      clearErrors();
    }
  }, [updateDenomination, clearErrors]);

  const handleRemoveDenomination = useCallback(async (id: string) => {
    const success = await removeDenomination(id);
    if (success) {
      clearErrors();
    }
  }, [removeDenomination, clearErrors]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!isValid) {
      return;
    }

    const success = await saveConfig();
    if (success) {
      // onSave will be called by the hook's onConfigCreated callback
    }
  }, [isValid, saveConfig]);

  // Handle skip
  const handleSkip = useCallback(async () => {
    const success = await skipGiftCards();
    if (success) {
      onSkip();
    }
  }, [skipGiftCards, onSkip]);

  // Handle preview
  const handlePreview = useCallback(() => {
    setShowPreview(true);
  }, []);

  const handleClosePreview = useCallback(() => {
    setShowPreview(false);
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading gift card setup...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Gift Cards
        </h2>
        <p className="text-gray-600">
          Set up gift cards for your customers to purchase and redeem
        </p>
      </div>

      {/* Enable/Disable Toggle */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              Enable Gift Cards
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Allow customers to purchase and redeem gift cards for your services
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => handleToggleEnabled(e.target.checked)}
              className="sr-only peer"
              disabled={isSubmitting}
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>

      {/* Gift Card Configuration */}
      {isEnabled && (
        <div className="space-y-6">
          {/* Expiration Policy */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Expiration Policy
            </h3>
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                When do gift cards expire?
              </label>
              <select
                value={expirationPolicy}
                onChange={(e) => handleExpirationPolicyChange(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                disabled={isSubmitting}
              >
                <option value="1 year from purchase">1 year from purchase</option>
                <option value="2 years from purchase">2 years from purchase</option>
                <option value="3 years from purchase">3 years from purchase</option>
                <option value="Never expires">Never expires</option>
              </select>
              <p className="text-sm text-gray-500">
                This policy will be displayed to customers when they purchase gift cards
              </p>
            </div>
          </div>

          {/* Denominations */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Gift Card Amounts
              </h3>
              <button
                type="button"
                onClick={handlePreview}
                className="text-sm text-blue-600 hover:text-blue-500"
                disabled={isSubmitting}
              >
                Preview
              </button>
            </div>
            
            <DenominationEditor
              denominations={denominations}
              onAdd={handleAddDenomination}
              onUpdate={handleUpdateDenomination}
              onRemove={handleRemoveDenomination}
              isLoading={isSubmitting}
              errors={errors}
            />
          </div>
        </div>
      )}

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Please fix the following errors:
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <ul className="list-disc pl-5 space-y-1">
                  {validationErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-6">
        <button
          type="button"
          onClick={handleSkip}
          className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          disabled={isSubmitting}
        >
          Skip Gift Cards
        </button>

        <div className="flex space-x-3">
          {isEnabled && (
            <button
              type="button"
              onClick={handleSave}
              disabled={!canProceed || isSubmitting}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Saving...
                </>
              ) : (
                'Save Gift Cards'
              )}
            </button>
          )}
          
          <button
            type="button"
            onClick={isEnabled ? handleSave : handleSkip}
            disabled={!canProceed || isSubmitting}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isEnabled ? 'Continue' : 'Skip & Continue'}
          </button>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <GiftCardPreview
          isEnabled={isEnabled}
          denominations={denominations}
          expirationPolicy={expirationPolicy}
          onClose={handleClosePreview}
        />
      )}
    </div>
  );
};


