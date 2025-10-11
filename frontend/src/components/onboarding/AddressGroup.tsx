/**
 * AddressGroup Component
 * 
 * Form component for capturing business address information.
 */

import React from 'react';
import type { AddressData } from '../../api/types/onboarding';

interface AddressGroupProps {
  address: AddressData;
  onChange: (address: Partial<AddressData>) => void;
  errors?: Record<string, string>;
  required?: boolean;
}

export const AddressGroup: React.FC<AddressGroupProps> = ({
  address,
  onChange,
  errors = {},
  required = false,
}) => {
  const handleFieldChange = (field: keyof AddressData, value: string) => {
    onChange({ [field]: value });
  };

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="street" className="block text-sm font-medium text-gray-700">
          Street Address {required && <span className="text-red-500">*</span>}
        </label>
        <input
          type="text"
          id="street"
          value={address.street || ''}
          onChange={(e) => handleFieldChange('street', e.target.value)}
          className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
            errors.street ? 'border-red-300' : ''
          }`}
          placeholder="123 Main Street"
        />
        {errors.street && (
          <p className="mt-1 text-sm text-red-600">{errors.street}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="city" className="block text-sm font-medium text-gray-700">
            City {required && <span className="text-red-500">*</span>}
          </label>
          <input
            type="text"
            id="city"
            value={address.city || ''}
            onChange={(e) => handleFieldChange('city', e.target.value)}
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
              errors.city ? 'border-red-300' : ''
            }`}
            placeholder="New York"
          />
          {errors.city && (
            <p className="mt-1 text-sm text-red-600">{errors.city}</p>
          )}
        </div>

        <div>
          <label htmlFor="state_province" className="block text-sm font-medium text-gray-700">
            State/Province {required && <span className="text-red-500">*</span>}
          </label>
          <input
            type="text"
            id="state_province"
            value={address.state_province || ''}
            onChange={(e) => handleFieldChange('state_province', e.target.value)}
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
              errors.state_province ? 'border-red-300' : ''
            }`}
            placeholder="NY"
          />
          {errors.state_province && (
            <p className="mt-1 text-sm text-red-600">{errors.state_province}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="postal_code" className="block text-sm font-medium text-gray-700">
            Postal Code {required && <span className="text-red-500">*</span>}
          </label>
          <input
            type="text"
            id="postal_code"
            value={address.postal_code || ''}
            onChange={(e) => handleFieldChange('postal_code', e.target.value)}
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
              errors.postal_code ? 'border-red-300' : ''
            }`}
            placeholder="10001"
          />
          {errors.postal_code && (
            <p className="mt-1 text-sm text-red-600">{errors.postal_code}</p>
          )}
        </div>

        <div>
          <label htmlFor="country" className="block text-sm font-medium text-gray-700">
            Country {required && <span className="text-red-500">*</span>}
          </label>
          <select
            id="country"
            value={address.country || 'US'}
            onChange={(e) => handleFieldChange('country', e.target.value)}
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
              errors.country ? 'border-red-300' : ''
            }`}
          >
            <option value="US">United States</option>
            <option value="CA">Canada</option>
            <option value="GB">United Kingdom</option>
            <option value="AU">Australia</option>
            <option value="DE">Germany</option>
            <option value="FR">France</option>
            <option value="IT">Italy</option>
            <option value="ES">Spain</option>
            <option value="JP">Japan</option>
            <option value="CN">China</option>
            <option value="IN">India</option>
            <option value="BR">Brazil</option>
            <option value="MX">Mexico</option>
            <option value="OTHER">Other</option>
          </select>
          {errors.country && (
            <p className="mt-1 text-sm text-red-600">{errors.country}</p>
          )}
        </div>
      </div>
    </div>
  );
};
