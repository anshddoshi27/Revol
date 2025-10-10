/**
 * KYCForm Component
 * 
 * Component for collecting Know Your Customer (KYC) information for business verification.
 * Handles business identity, representative details, and payout destination configuration.
 */

import React, { useState, useEffect } from 'react';
import { telemetry } from '../../services/telemetry';
import type { 
  KYCFormData, 
  KYCValidationErrors,
  KYCAddress,
  PayoutDestination,
  BUSINESS_TYPES,
  CURRENCIES,
  TAX_DISPLAY_OPTIONS,
  PAYOUT_DESTINATION_TYPES,
  ACCOUNT_HOLDER_TYPES
} from '../../api/types/payments';
import { 
  BUSINESS_TYPES as businessTypes,
  CURRENCIES as currencies,
  TAX_DISPLAY_OPTIONS as taxDisplayOptions,
  PAYOUT_DESTINATION_TYPES as payoutTypes,
  ACCOUNT_HOLDER_TYPES as accountHolderTypes,
  validateEmail,
  validatePhone,
  validateStatementDescriptor,
  validateTaxId,
  validateRoutingNumber,
  validateAccountNumber
} from '../../api/types/payments';

interface KYCFormProps {
  tenantId: string;
  onFormChange: (data: KYCFormData) => void;
  onError: (error: string) => void;
  initialData?: Partial<KYCFormData>;
  disabled?: boolean;
}

export const KYCForm: React.FC<KYCFormProps> = ({
  tenantId,
  onFormChange,
  onError,
  initialData,
  disabled = false
}) => {
  const [formData, setFormData] = useState<KYCFormData>({
    legal_name: '',
    dba_name: '',
    representative_name: '',
    representative_email: '',
    representative_phone: '',
    business_type: 'llc',
    tax_id: '',
    address: {
      street: '',
      city: '',
      state_province: '',
      postal_code: '',
      country: 'US',
    },
    payout_destination: {
      type: 'bank_account',
      account_holder_name: '',
      account_holder_type: 'company',
      routing_number: '',
      account_number: '',
    },
    statement_descriptor: '',
    tax_display: 'inclusive',
    currency: 'USD',
    ...initialData
  });

  const [errors, setErrors] = useState<KYCValidationErrors>({});
  const [isValidating, setIsValidating] = useState(false);

  // Notify parent of form changes
  useEffect(() => {
    onFormChange(formData);
  }, [formData, onFormChange]);

  const validateForm = (): boolean => {
    const newErrors: KYCValidationErrors = {};

    // Legal name validation
    if (!formData.legal_name.trim()) {
      newErrors.legal_name = 'Legal business name is required';
    }

    // Representative validation
    if (!formData.representative_name.trim()) {
      newErrors.representative_name = 'Representative name is required';
    }

    if (!formData.representative_email.trim()) {
      newErrors.representative_email = 'Representative email is required';
    } else if (!validateEmail(formData.representative_email)) {
      newErrors.representative_email = 'Please enter a valid email address';
    }

    if (!formData.representative_phone.trim()) {
      newErrors.representative_phone = 'Representative phone is required';
    } else if (!validatePhone(formData.representative_phone)) {
      newErrors.representative_phone = 'Please enter a valid phone number';
    }

    // Tax ID validation (optional but if provided, must be valid)
    if (formData.tax_id && !validateTaxId(formData.tax_id)) {
      newErrors.tax_id = 'Please enter a valid tax ID (9 digits)';
    }

    // Address validation
    if (!formData.address.street.trim()) {
      newErrors.address = { ...newErrors.address, street: 'Street address is required' };
    }
    if (!formData.address.city.trim()) {
      newErrors.address = { ...newErrors.address, city: 'City is required' };
    }
    if (!formData.address.state_province.trim()) {
      newErrors.address = { ...newErrors.address, state_province: 'State/Province is required' };
    }
    if (!formData.address.postal_code.trim()) {
      newErrors.address = { ...newErrors.address, postal_code: 'Postal code is required' };
    }

    // Payout destination validation
    if (!formData.payout_destination.account_holder_name.trim()) {
      newErrors.payout_destination = { 
        ...newErrors.payout_destination, 
        account_holder_name: 'Account holder name is required' 
      };
    }

    if (formData.payout_destination.type === 'bank_account') {
      if (!formData.payout_destination.routing_number?.trim()) {
        newErrors.payout_destination = { 
          ...newErrors.payout_destination, 
          routing_number: 'Routing number is required' 
        };
      } else if (!validateRoutingNumber(formData.payout_destination.routing_number)) {
        newErrors.payout_destination = { 
          ...newErrors.payout_destination, 
          routing_number: 'Please enter a valid 9-digit routing number' 
        };
      }

      if (!formData.payout_destination.account_number?.trim()) {
        newErrors.payout_destination = { 
          ...newErrors.payout_destination, 
          account_number: 'Account number is required' 
        };
      } else if (!validateAccountNumber(formData.payout_destination.account_number)) {
        newErrors.payout_destination = { 
          ...newErrors.payout_destination, 
          account_number: 'Please enter a valid account number' 
        };
      }
    }

    // Statement descriptor validation
    if (!formData.statement_descriptor.trim()) {
      newErrors.statement_descriptor = 'Statement descriptor is required';
    } else if (!validateStatementDescriptor(formData.statement_descriptor)) {
      newErrors.statement_descriptor = 'Statement descriptor must be 5-22 characters, letters and numbers only';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFieldChange = (field: keyof KYCFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleAddressChange = (field: keyof KYCAddress, value: string) => {
    setFormData(prev => ({
      ...prev,
      address: { ...prev.address, [field]: value }
    }));
    
    // Clear error when user starts typing
    if (errors.address?.[field]) {
      setErrors(prev => ({
        ...prev,
        address: { ...prev.address, [field]: undefined }
      }));
    }
  };

  const handlePayoutDestinationChange = (field: keyof PayoutDestination, value: any) => {
    setFormData(prev => ({
      ...prev,
      payout_destination: { ...prev.payout_destination, [field]: value }
    }));
    
    // Clear error when user starts typing
    if (errors.payout_destination?.[field]) {
      setErrors(prev => ({
        ...prev,
        payout_destination: { ...prev.payout_destination, [field]: undefined }
      }));
    }
  };

  const handlePayoutTypeChange = (type: 'bank_account' | 'card') => {
    const newPayoutDestination: PayoutDestination = {
      type,
      account_holder_name: formData.payout_destination.account_holder_name,
      account_holder_type: formData.payout_destination.account_holder_type,
    };

    if (type === 'bank_account') {
      newPayoutDestination.routing_number = '';
      newPayoutDestination.account_number = '';
    } else {
      newPayoutDestination.card_number = '';
      newPayoutDestination.expiry_month = undefined;
      newPayoutDestination.expiry_year = undefined;
    }

    setFormData(prev => ({
      ...prev,
      payout_destination: newPayoutDestination
    }));

    // Clear payout destination errors
    setErrors(prev => ({
      ...prev,
      payout_destination: {}
    }));
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h3 className="text-lg font-medium text-gray-900">
          Business Verification
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          We need to verify your business identity to process payments and comply with regulations.
        </p>
      </div>

      {/* Business Information */}
      <div className="space-y-6">
        <h4 className="text-md font-medium text-gray-900">Business Information</h4>
        
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="legal_name" className="block text-sm font-medium text-gray-700">
              Legal Business Name *
            </label>
            <input
              type="text"
              id="legal_name"
              value={formData.legal_name}
              onChange={(e) => handleFieldChange('legal_name', e.target.value)}
              disabled={disabled}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-50 disabled:text-gray-500"
              placeholder="Enter your legal business name"
            />
            {errors.legal_name && (
              <p className="mt-1 text-sm text-red-600">{errors.legal_name}</p>
            )}
          </div>

          <div>
            <label htmlFor="dba_name" className="block text-sm font-medium text-gray-700">
              DBA Name (Optional)
            </label>
            <input
              type="text"
              id="dba_name"
              value={formData.dba_name}
              onChange={(e) => handleFieldChange('dba_name', e.target.value)}
              disabled={disabled}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-50 disabled:text-gray-500"
              placeholder="Doing Business As name"
            />
            {errors.dba_name && (
              <p className="mt-1 text-sm text-red-600">{errors.dba_name}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="business_type" className="block text-sm font-medium text-gray-700">
              Business Type *
            </label>
            <select
              id="business_type"
              value={formData.business_type}
              onChange={(e) => handleFieldChange('business_type', e.target.value)}
              disabled={disabled}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-50 disabled:text-gray-500"
            >
              {businessTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            {errors.business_type && (
              <p className="mt-1 text-sm text-red-600">{errors.business_type}</p>
            )}
          </div>

          <div>
            <label htmlFor="tax_id" className="block text-sm font-medium text-gray-700">
              Tax ID (Optional)
            </label>
            <input
              type="text"
              id="tax_id"
              value={formData.tax_id}
              onChange={(e) => handleFieldChange('tax_id', e.target.value)}
              disabled={disabled}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-50 disabled:text-gray-500"
              placeholder="XX-XXXXXXX"
            />
            {errors.tax_id && (
              <p className="mt-1 text-sm text-red-600">{errors.tax_id}</p>
            )}
          </div>
        </div>
      </div>

      {/* Representative Information */}
      <div className="space-y-6">
        <h4 className="text-md font-medium text-gray-900">Representative Information</h4>
        
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="representative_name" className="block text-sm font-medium text-gray-700">
              Representative Name *
            </label>
            <input
              type="text"
              id="representative_name"
              value={formData.representative_name}
              onChange={(e) => handleFieldChange('representative_name', e.target.value)}
              disabled={disabled}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-50 disabled:text-gray-500"
              placeholder="Full name of business representative"
            />
            {errors.representative_name && (
              <p className="mt-1 text-sm text-red-600">{errors.representative_name}</p>
            )}
          </div>

          <div>
            <label htmlFor="representative_email" className="block text-sm font-medium text-gray-700">
              Representative Email *
            </label>
            <input
              type="email"
              id="representative_email"
              value={formData.representative_email}
              onChange={(e) => handleFieldChange('representative_email', e.target.value)}
              disabled={disabled}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-50 disabled:text-gray-500"
              placeholder="representative@business.com"
            />
            {errors.representative_email && (
              <p className="mt-1 text-sm text-red-600">{errors.representative_email}</p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="representative_phone" className="block text-sm font-medium text-gray-700">
            Representative Phone *
          </label>
          <input
            type="tel"
            id="representative_phone"
            value={formData.representative_phone}
            onChange={(e) => handleFieldChange('representative_phone', e.target.value)}
            disabled={disabled}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-50 disabled:text-gray-500"
            placeholder="+1 (555) 123-4567"
          />
          {errors.representative_phone && (
            <p className="mt-1 text-sm text-red-600">{errors.representative_phone}</p>
          )}
        </div>
      </div>

      {/* Business Address */}
      <div className="space-y-6">
        <h4 className="text-md font-medium text-gray-900">Business Address</h4>
        
        <div>
          <label htmlFor="street" className="block text-sm font-medium text-gray-700">
            Street Address *
          </label>
          <input
            type="text"
            id="street"
            value={formData.address.street}
            onChange={(e) => handleAddressChange('street', e.target.value)}
            disabled={disabled}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-50 disabled:text-gray-500"
            placeholder="123 Main Street"
          />
          {errors.address?.street && (
            <p className="mt-1 text-sm text-red-600">{errors.address.street}</p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div>
            <label htmlFor="city" className="block text-sm font-medium text-gray-700">
              City *
            </label>
            <input
              type="text"
              id="city"
              value={formData.address.city}
              onChange={(e) => handleAddressChange('city', e.target.value)}
              disabled={disabled}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-50 disabled:text-gray-500"
              placeholder="New York"
            />
            {errors.address?.city && (
              <p className="mt-1 text-sm text-red-600">{errors.address.city}</p>
            )}
          </div>

          <div>
            <label htmlFor="state_province" className="block text-sm font-medium text-gray-700">
              State/Province *
            </label>
            <input
              type="text"
              id="state_province"
              value={formData.address.state_province}
              onChange={(e) => handleAddressChange('state_province', e.target.value)}
              disabled={disabled}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-50 disabled:text-gray-500"
              placeholder="NY"
            />
            {errors.address?.state_province && (
              <p className="mt-1 text-sm text-red-600">{errors.address.state_province}</p>
            )}
          </div>

          <div>
            <label htmlFor="postal_code" className="block text-sm font-medium text-gray-700">
              Postal Code *
            </label>
            <input
              type="text"
              id="postal_code"
              value={formData.address.postal_code}
              onChange={(e) => handleAddressChange('postal_code', e.target.value)}
              disabled={disabled}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-50 disabled:text-gray-500"
              placeholder="10001"
            />
            {errors.address?.postal_code && (
              <p className="mt-1 text-sm text-red-600">{errors.address.postal_code}</p>
            )}
          </div>
        </div>
      </div>

      {/* Payout Destination */}
      <div className="space-y-6">
        <h4 className="text-md font-medium text-gray-900">Payout Destination</h4>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Payout Method *
          </label>
          <div className="space-y-3">
            {payoutTypes.map((type) => (
              <div key={type.value} className="flex items-center">
                <input
                  id={`payout_${type.value}`}
                  type="radio"
                  value={type.value}
                  checked={formData.payout_destination.type === type.value}
                  onChange={(e) => handlePayoutTypeChange(e.target.value as 'bank_account' | 'card')}
                  disabled={disabled}
                  className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300"
                />
                <label htmlFor={`payout_${type.value}`} className="ml-3 text-sm font-medium text-gray-700">
                  {type.label}
                </label>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="account_holder_name" className="block text-sm font-medium text-gray-700">
            Account Holder Name *
          </label>
          <input
            type="text"
            id="account_holder_name"
            value={formData.payout_destination.account_holder_name}
            onChange={(e) => handlePayoutDestinationChange('account_holder_name', e.target.value)}
            disabled={disabled}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-50 disabled:text-gray-500"
            placeholder="Account holder name"
          />
          {errors.payout_destination?.account_holder_name && (
            <p className="mt-1 text-sm text-red-600">{errors.payout_destination.account_holder_name}</p>
          )}
        </div>

        {formData.payout_destination.type === 'bank_account' && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="routing_number" className="block text-sm font-medium text-gray-700">
                Routing Number *
              </label>
              <input
                type="text"
                id="routing_number"
                value={formData.payout_destination.routing_number || ''}
                onChange={(e) => handlePayoutDestinationChange('routing_number', e.target.value)}
                disabled={disabled}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-50 disabled:text-gray-500"
                placeholder="123456789"
              />
              {errors.payout_destination?.routing_number && (
                <p className="mt-1 text-sm text-red-600">{errors.payout_destination.routing_number}</p>
              )}
            </div>

            <div>
              <label htmlFor="account_number" className="block text-sm font-medium text-gray-700">
                Account Number *
              </label>
              <input
                type="text"
                id="account_number"
                value={formData.payout_destination.account_number || ''}
                onChange={(e) => handlePayoutDestinationChange('account_number', e.target.value)}
                disabled={disabled}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-50 disabled:text-gray-500"
                placeholder="Account number"
              />
              {errors.payout_destination?.account_number && (
                <p className="mt-1 text-sm text-red-600">{errors.payout_destination.account_number}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Payment Settings */}
      <div className="space-y-6">
        <h4 className="text-md font-medium text-gray-900">Payment Settings</h4>
        
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="statement_descriptor" className="block text-sm font-medium text-gray-700">
              Statement Descriptor *
            </label>
            <input
              type="text"
              id="statement_descriptor"
              value={formData.statement_descriptor}
              onChange={(e) => handleFieldChange('statement_descriptor', e.target.value)}
              disabled={disabled}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-50 disabled:text-gray-500"
              placeholder="BUSINESS NAME"
              maxLength={22}
            />
            <p className="mt-1 text-sm text-gray-500">
              This appears on customer credit card statements (5-22 characters, letters and numbers only)
            </p>
            {errors.statement_descriptor && (
              <p className="mt-1 text-sm text-red-600">{errors.statement_descriptor}</p>
            )}
          </div>

          <div>
            <label htmlFor="tax_display" className="block text-sm font-medium text-gray-700">
              Tax Display *
            </label>
            <select
              id="tax_display"
              value={formData.tax_display}
              onChange={(e) => handleFieldChange('tax_display', e.target.value)}
              disabled={disabled}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-50 disabled:text-gray-500"
            >
              {taxDisplayOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors.tax_display && (
              <p className="mt-1 text-sm text-red-600">{errors.tax_display}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

