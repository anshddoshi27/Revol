/**
 * PlaceholderValidator Component
 * 
 * Component for validating and managing placeholders in notification templates.
 * Shows available placeholders, validates required ones, and provides visual feedback.
 */

import React, { useState, useCallback } from 'react';
import { usePlaceholderValidation } from '../../hooks/usePlaceholderValidation';
import type { PlaceholderKey } from '../../api/types/notifications';

interface PlaceholderValidatorProps {
  content: string;
  requiredVariables: string[];
  onContentChange: (content: string) => void;
  onRequiredVariablesChange: (variables: string[]) => void;
  className?: string;
  showAvailablePlaceholders?: boolean;
  showRequiredVariables?: boolean;
  showValidationErrors?: boolean;
}

export const PlaceholderValidator: React.FC<PlaceholderValidatorProps> = ({
  content,
  requiredVariables,
  onContentChange,
  onRequiredVariablesChange,
  className = '',
  showAvailablePlaceholders = true,
  showRequiredVariables = true,
  showValidationErrors = true,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const {
    extractedPlaceholders,
    missingPlaceholders,
    invalidPlaceholders,
    isValid,
    availablePlaceholders,
    addRequiredVariable,
    removeRequiredVariable,
  } = usePlaceholderValidation({
    initialContent: content,
    initialRequiredVariables: requiredVariables,
  });

  // Handle placeholder insertion
  const insertPlaceholder = useCallback((placeholder: string) => {
    const newContent = content + `{${placeholder}}`;
    onContentChange(newContent);
  }, [content, onContentChange]);

  // Handle required variable toggle
  const toggleRequiredVariable = useCallback((variable: string) => {
    if (requiredVariables.includes(variable)) {
      removeRequiredVariable(variable);
      onRequiredVariablesChange(requiredVariables.filter(v => v !== variable));
    } else {
      addRequiredVariable(variable);
      onRequiredVariablesChange([...requiredVariables, variable]);
    }
  }, [requiredVariables, addRequiredVariable, removeRequiredVariable, onRequiredVariablesChange]);

  // Get placeholder display name
  const getPlaceholderDisplayName = (placeholder: string): string => {
    const displayNames: Record<string, string> = {
      customer_name: 'Customer Name',
      service_name: 'Service Name',
      service_duration: 'Service Duration',
      price: 'Price',
      booking_date: 'Booking Date',
      booking_time: 'Booking Time',
      business_name: 'Business Name',
      address: 'Address',
      staff_name: 'Staff Name',
      instructions: 'Instructions',
      special_requests: 'Special Requests',
      cancel_policy: 'Cancel Policy',
      refund_policy: 'Refund Policy',
      booking_link: 'Booking Link',
      ics_link: 'Calendar Link',
    };
    return displayNames[placeholder] || placeholder;
  };

  // Get placeholder description
  const getPlaceholderDescription = (placeholder: string): string => {
    const descriptions: Record<string, string> = {
      customer_name: 'The customer\'s full name',
      service_name: 'The name of the booked service',
      service_duration: 'Duration of the service (e.g., "60 minutes")',
      price: 'Price of the service (e.g., "$75.00")',
      booking_date: 'Date of the booking (e.g., "March 15, 2024")',
      booking_time: 'Time of the booking (e.g., "2:00 PM")',
      business_name: 'Your business name',
      address: 'Your business address',
      staff_name: 'Name of the assigned staff member',
      instructions: 'Pre-appointment instructions',
      special_requests: 'Customer\'s special requests',
      cancel_policy: 'Your cancellation policy',
      refund_policy: 'Your refund policy',
      booking_link: 'Link to view/manage the booking',
      ics_link: 'Link to add to calendar',
    };
    return descriptions[placeholder] || 'No description available';
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Validation Status */}
      {showValidationErrors && (
        <div className="space-y-2">
          {/* Overall Status */}
          <div className={`flex items-center space-x-2 text-sm ${
            isValid ? 'text-green-600' : 'text-red-600'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              isValid ? 'bg-green-500' : 'bg-red-500'
            }`} />
            <span>
              {isValid ? 'All placeholders are valid' : 'Some placeholders need attention'}
            </span>
          </div>

          {/* Missing Required Placeholders */}
          {missingPlaceholders.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <h4 className="text-sm font-medium text-red-800 mb-2">
                Missing Required Placeholders
              </h4>
              <ul className="text-sm text-red-700 space-y-1">
                {missingPlaceholders.map(placeholder => (
                  <li key={placeholder} className="flex items-center space-x-2">
                    <span className="font-mono bg-red-100 px-2 py-1 rounded text-xs">
                      {`{${placeholder}}`}
                    </span>
                    <span>{getPlaceholderDisplayName(placeholder)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Invalid Placeholders */}
          {invalidPlaceholders.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
              <h4 className="text-sm font-medium text-yellow-800 mb-2">
                Invalid Placeholders
              </h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                {invalidPlaceholders.map(placeholder => (
                  <li key={placeholder} className="flex items-center space-x-2">
                    <span className="font-mono bg-yellow-100 px-2 py-1 rounded text-xs">
                      {`{${placeholder}}`}
                    </span>
                    <span>Not recognized</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Available Placeholders */}
      {showAvailablePlaceholders && (
        <div className="border border-gray-200 rounded-md">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
          >
            <div>
              <h3 className="text-sm font-medium text-gray-900">
                Available Placeholders
              </h3>
              <p className="text-sm text-gray-500">
                Click to insert into your template
              </p>
            </div>
            <svg
              className={`w-5 h-5 text-gray-400 transform transition-transform ${
                isExpanded ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isExpanded && (
            <div className="border-t border-gray-200 p-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {availablePlaceholders.map(placeholder => (
                  <button
                    key={placeholder}
                    type="button"
                    onClick={() => insertPlaceholder(placeholder)}
                    className="flex items-center justify-between p-2 text-left hover:bg-blue-50 rounded-md border border-gray-200 hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {getPlaceholderDisplayName(placeholder)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {getPlaceholderDescription(placeholder)}
                      </div>
                    </div>
                    <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                      {`{${placeholder}}`}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Required Variables Configuration */}
      {showRequiredVariables && (
        <div className="border border-gray-200 rounded-md p-3">
          <h3 className="text-sm font-medium text-gray-900 mb-3">
            Required Variables
          </h3>
          <p className="text-sm text-gray-500 mb-3">
            Select which placeholders must be present in your template
          </p>
          
          <div className="space-y-2">
            {availablePlaceholders.map(placeholder => (
              <label
                key={placeholder}
                className="flex items-center space-x-3 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={requiredVariables.includes(placeholder)}
                  onChange={() => toggleRequiredVariable(placeholder)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">
                    {getPlaceholderDisplayName(placeholder)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {getPlaceholderDescription(placeholder)}
                  </div>
                </div>
                <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                  {`{${placeholder}}`}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Extracted Placeholders Summary */}
      {extractedPlaceholders.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
          <h4 className="text-sm font-medium text-gray-900 mb-2">
            Placeholders in Template
          </h4>
          <div className="flex flex-wrap gap-2">
            {extractedPlaceholders.map(placeholder => (
              <span
                key={placeholder}
                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  requiredVariables.includes(placeholder)
                    ? 'bg-green-100 text-green-800'
                    : 'bg-blue-100 text-blue-800'
                }`}
              >
                {`{${placeholder}}`}
                {requiredVariables.includes(placeholder) && (
                  <span className="ml-1 text-green-600">✓</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
