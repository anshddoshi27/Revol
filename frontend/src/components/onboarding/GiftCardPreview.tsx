/**
 * GiftCardPreview Component
 * 
 * Modal component for previewing gift card configuration.
 * Shows how gift cards will appear to customers.
 */

import React from 'react';
import { formatAmount } from '../../api/types/giftCards';
import type { Denomination } from '../../api/types/giftCards';

interface GiftCardPreviewProps {
  isEnabled: boolean;
  denominations: Denomination[];
  expirationPolicy: string;
  onClose: () => void;
}

export const GiftCardPreview: React.FC<GiftCardPreviewProps> = ({
  isEnabled,
  denominations,
  expirationPolicy,
  onClose,
}) => {
  // Handle escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={handleBackdropClick}
        />

        {/* Modal */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          {/* Header */}
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Gift Card Preview
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md p-1"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Preview Content */}
            <div className="space-y-6">
              {/* Status */}
              <div className="text-center">
                <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  isEnabled 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {isEnabled ? 'Gift Cards Enabled' : 'Gift Cards Disabled'}
                </div>
              </div>

              {/* Gift Card Configuration */}
              {isEnabled && (
                <div className="space-y-4">
                  {/* Expiration Policy */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-2">
                      Expiration Policy
                    </h4>
                    <p className="text-sm text-gray-600">
                      {expirationPolicy}
                    </p>
                  </div>

                  {/* Denominations */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">
                      Available Amounts
                    </h4>
                    {denominations.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2">
                        {denominations.map((denomination) => (
                          <div
                            key={denomination.id}
                            className="flex items-center justify-between p-2 bg-white rounded border"
                          >
                            <span className="text-sm font-medium text-gray-900">
                              {formatAmount(denomination.amount_cents)}
                            </span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              denomination.is_active 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {denomination.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 italic">
                        No denominations configured
                      </p>
                    )}
                  </div>

                  {/* Customer View Preview */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">
                      Customer View Preview
                    </h4>
                    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                      <div className="text-center">
                        <h5 className="text-lg font-semibold text-gray-900">
                          Gift Cards
                        </h5>
                        <p className="text-sm text-gray-600">
                          Perfect for any occasion
                        </p>
                      </div>
                      
                      {denominations.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-gray-700">
                            Choose an amount:
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            {denominations.filter(d => d.is_active).map((denomination) => (
                              <button
                                key={denomination.id}
                                className="p-3 border border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                              >
                                <div className="text-lg font-semibold text-gray-900">
                                  {formatAmount(denomination.amount_cents)}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="text-xs text-gray-500 text-center">
                        Expires: {expirationPolicy}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Disabled State */}
              {!isEnabled && (
                <div className="text-center py-8">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">
                    Gift Cards Disabled
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Customers will not see gift card options when booking.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              onClick={onClose}
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
            >
              Close Preview
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


