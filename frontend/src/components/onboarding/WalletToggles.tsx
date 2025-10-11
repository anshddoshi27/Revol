/**
 * WalletToggles Component
 * 
 * Component for configuring supported payment methods (wallets) for the business.
 * Handles toggles for Cards, Apple Pay, Google Pay, PayPal, and Cash with validation.
 */

import React, { useState, useEffect } from 'react';
import { telemetry } from '../../services/telemetry';
import type { 
  WalletConfig, 
  WalletConfigFormData, 
  WalletValidationErrors 
} from '../../api/types/payments';

interface WalletTogglesProps {
  tenantId: string;
  onConfigChange: (config: WalletConfig) => void;
  onError: (error: string) => void;
  initialConfig?: Partial<WalletConfig>;
  disabled?: boolean;
}

export const WalletToggles: React.FC<WalletTogglesProps> = ({
  tenantId,
  onConfigChange,
  onError,
  initialConfig,
  disabled = false
}) => {
  const [config, setConfig] = useState<WalletConfigFormData>({
    cards: true, // Always enabled as default
    apple_pay: false,
    google_pay: false,
    paypal: false,
    cash: false,
    ...initialConfig
  });

  const [errors, setErrors] = useState<WalletValidationErrors>({});
  const [isLoading, setIsLoading] = useState(false);

  // Notify parent of config changes
  useEffect(() => {
    const walletConfig: WalletConfig = {
      ...config,
      cash_requires_card: config.cash && config.cards, // Cash requires cards to be enabled
    };
    onConfigChange(walletConfig);
  }, [config, onConfigChange]);

  const validateConfig = (): boolean => {
    const newErrors: WalletValidationErrors = {};

    // Cards must always be enabled
    if (!config.cards) {
      newErrors.cards = 'Card payments must be enabled';
    }

    // If cash is enabled, cards must also be enabled
    if (config.cash && !config.cards) {
      newErrors.cash = 'Cash payments require card payments to be enabled';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleToggleChange = (field: keyof WalletConfigFormData, value: boolean) => {
    // Special handling for cards - if disabling cards, also disable cash
    if (field === 'cards' && !value && config.cash) {
      setConfig(prev => ({
        ...prev,
        [field]: value,
        cash: false, // Disable cash if cards are disabled
      }));
    } else {
      setConfig(prev => ({
        ...prev,
        [field]: value,
      }));
    }

    // Clear error when user changes setting
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }

    // Emit analytics event
    telemetry.track('wallets.toggle_update', {
      tenant_id: tenantId,
      wallet_type: field,
      enabled: value,
    });
  };

  const walletOptions = [
    {
      id: 'cards' as keyof WalletConfigFormData,
      name: 'Credit/Debit Cards',
      description: 'Accept Visa, Mastercard, American Express, and Discover',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      ),
      required: true,
      disabled: true, // Always enabled
    },
    {
      id: 'apple_pay' as keyof WalletConfigFormData,
      name: 'Apple Pay',
      description: 'Accept payments through Apple Pay on iOS devices',
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
        </svg>
      ),
      required: false,
      disabled: false,
    },
    {
      id: 'google_pay' as keyof WalletConfigFormData,
      name: 'Google Pay',
      description: 'Accept payments through Google Pay on Android devices',
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M3.609 1.814L13.792 12 3.609 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.198l2.807 1.626a1 1 0 010 1.73l-2.808 1.626L15.496 12l2.202-2.491zM5.864 2.658L16.802 8.99l-2.302 2.302-8.636-8.634z"/>
        </svg>
      ),
      required: false,
      disabled: false,
    },
    {
      id: 'paypal' as keyof WalletConfigFormData,
      name: 'PayPal',
      description: 'Accept payments through PayPal accounts',
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.105-.633c-.365-1.882-1.46-3.2-3.338-3.2H9.95c-.524 0-.968.382-1.05.9L7.76 19.337h4.716c.524 0 .968-.382 1.05-.9l1.12-7.106h2.19c2.57 0 4.578-.543 5.69-1.81 1.01-1.15 1.304-2.42 1.012-4.287z"/>
        </svg>
      ),
      required: false,
      disabled: false,
    },
    {
      id: 'cash' as keyof WalletConfigFormData,
      name: 'Cash Payments',
      description: 'Accept cash payments (requires card on file for no-shows)',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      required: false,
      disabled: !config.cards, // Disabled if cards are not enabled
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-medium text-gray-900">
          Payment Methods
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Choose which payment methods your customers can use to book appointments.
        </p>
      </div>

      {/* Cash Payment Warning */}
      {config.cash && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                Cash Payment Policy
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  When cash payments are enabled, customers must provide a card on file to cover no-show fees. 
                  The card will only be charged if the customer doesn't show up for their appointment.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Wallet Options */}
      <div className="space-y-4">
        {walletOptions.map((option) => (
          <div
            key={option.id}
            className={`relative flex items-start p-4 border rounded-lg ${
              config[option.id] 
                ? 'border-blue-200 bg-blue-50' 
                : 'border-gray-200 bg-white'
            } ${option.disabled || disabled ? 'opacity-50' : ''}`}
          >
            <div className="flex items-center h-5">
              <input
                id={option.id}
                type="checkbox"
                checked={config[option.id]}
                onChange={(e) => handleToggleChange(option.id, e.target.checked)}
                disabled={option.disabled || disabled}
                className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
              />
            </div>
            <div className="ml-3 flex-1">
              <div className="flex items-center">
                <div className={`flex-shrink-0 mr-3 ${
                  config[option.id] ? 'text-blue-600' : 'text-gray-400'
                }`}>
                  {option.icon}
                </div>
                <div className="flex-1">
                  <label 
                    htmlFor={option.id} 
                    className={`text-sm font-medium ${
                      config[option.id] ? 'text-blue-900' : 'text-gray-900'
                    }`}
                  >
                    {option.name}
                    {option.required && (
                      <span className="ml-1 text-red-500">*</span>
                    )}
                  </label>
                  <p className={`text-sm ${
                    config[option.id] ? 'text-blue-700' : 'text-gray-500'
                  }`}>
                    {option.description}
                  </p>
                </div>
              </div>
              {errors[option.id] && (
                <p className="mt-2 text-sm text-red-600">{errors[option.id]}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-900 mb-2">
          Payment Method Summary
        </h4>
        <div className="text-sm text-gray-600">
          <p>
            Customers will be able to pay using:{' '}
            {Object.entries(config)
              .filter(([key, value]) => value && key !== 'cash_requires_card')
              .map(([key]) => walletOptions.find(opt => opt.id === key)?.name)
              .join(', ') || 'None selected'}
          </p>
          {config.cash && (
            <p className="mt-1 text-yellow-700">
              <strong>Note:</strong> Cash payments require a card on file for no-show protection.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

