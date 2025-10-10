/**
 * DenominationEditor Component
 * 
 * Component for managing gift card denominations (amounts).
 * Allows adding, editing, and removing gift card amounts.
 */

import React, { useState, useCallback } from 'react';
import { COMMON_DENOMINATIONS, formatAmount, parseAmount, validateDenomination } from '../../api/types/giftCards';
import type { Denomination, DenominationValidationErrors } from '../../api/types/giftCards';

interface DenominationEditorProps {
  denominations: Denomination[];
  onAdd: (amountCents: number) => Promise<boolean>;
  onUpdate: (id: string, amountCents: number) => Promise<boolean>;
  onRemove: (id: string) => Promise<boolean>;
  isLoading?: boolean;
  errors?: DenominationValidationErrors;
}

export const DenominationEditor: React.FC<DenominationEditorProps> = ({
  denominations,
  onAdd,
  onUpdate,
  onRemove,
  isLoading = false,
  errors = {},
}) => {
  const [newAmount, setNewAmount] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingAmount, setEditingAmount] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Handle adding new denomination
  const handleAddDenomination = useCallback(async () => {
    if (!newAmount.trim()) {
      setValidationError('Please enter an amount');
      return;
    }

    const amountCents = parseAmount(newAmount);
    const validation = validateDenomination(amountCents);
    
    if (validation) {
      setValidationError(validation);
      return;
    }

    // Check for duplicates
    if (denominations.some(d => d.amount_cents === amountCents)) {
      setValidationError('This amount already exists');
      return;
    }

    setValidationError(null);
    const success = await onAdd(amountCents);
    
    if (success) {
      setNewAmount('');
    }
  }, [newAmount, denominations, onAdd]);

  // Handle editing denomination
  const handleStartEdit = useCallback((denomination: Denomination) => {
    setEditingId(denomination.id!);
    setEditingAmount(formatAmount(denomination.amount_cents));
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditingAmount('');
  }, []);

  const handleSaveEdit = useCallback(async (id: string) => {
    if (!editingAmount.trim()) {
      setValidationError('Please enter an amount');
      return;
    }

    const amountCents = parseAmount(editingAmount);
    const validation = validateDenomination(amountCents);
    
    if (validation) {
      setValidationError(validation);
      return;
    }

    // Check for duplicates (excluding current item)
    if (denominations.some(d => d.id !== id && d.amount_cents === amountCents)) {
      setValidationError('This amount already exists');
      return;
    }

    setValidationError(null);
    const success = await onUpdate(id, amountCents);
    
    if (success) {
      setEditingId(null);
      setEditingAmount('');
    }
  }, [editingAmount, denominations, onUpdate]);

  // Handle removing denomination
  const handleRemoveDenomination = useCallback(async (id: string) => {
    if (window.confirm('Are you sure you want to remove this denomination?')) {
      await onRemove(id);
    }
  }, [onRemove]);

  // Handle common denomination click
  const handleCommonDenominationClick = useCallback(async (amountCents: number) => {
    // Check if already exists
    if (denominations.some(d => d.amount_cents === amountCents)) {
      setValidationError('This amount already exists');
      return;
    }

    setValidationError(null);
    await onAdd(amountCents);
  }, [denominations, onAdd]);

  // Handle input key press
  const handleKeyPress = useCallback((e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter') {
      action();
    }
  }, []);

  return (
    <div className="space-y-4">
      {/* Current Denominations */}
      {denominations.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-3">
            Current Gift Card Amounts
          </h4>
          <div className="space-y-2">
            {denominations.map((denomination) => (
              <div
                key={denomination.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                {editingId === denomination.id ? (
                  <div className="flex items-center space-x-2 flex-1">
                    <span className="text-sm text-gray-500">$</span>
                    <input
                      type="text"
                      value={editingAmount}
                      onChange={(e) => setEditingAmount(e.target.value)}
                      onKeyPress={(e) => handleKeyPress(e, () => handleSaveEdit(denomination.id!))}
                      className="flex-1 px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0.00"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(denomination.id!)}
                      disabled={isLoading}
                      className="px-3 py-1 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      disabled={isLoading}
                      className="px-3 py-1 text-sm text-gray-600 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center space-x-3">
                      <span className="text-lg font-medium text-gray-900">
                        {formatAmount(denomination.amount_cents)}
                      </span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        denomination.is_active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {denomination.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(denomination)}
                        disabled={isLoading}
                        className="text-sm text-blue-600 hover:text-blue-500 focus:outline-none focus:underline disabled:opacity-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveDenomination(denomination.id!)}
                        disabled={isLoading}
                        className="text-sm text-red-600 hover:text-red-500 focus:outline-none focus:underline disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add New Denomination */}
      <div>
        <h4 className="text-sm font-medium text-gray-900 mb-3">
          Add New Amount
        </h4>
        
        {/* Common Denominations */}
        <div className="mb-4">
          <p className="text-sm text-gray-500 mb-2">Quick add common amounts:</p>
          <div className="flex flex-wrap gap-2">
            {COMMON_DENOMINATIONS.map((denomination) => (
              <button
                key={denomination.amount_cents}
                type="button"
                onClick={() => handleCommonDenominationClick(denomination.amount_cents)}
                disabled={isLoading || denominations.some(d => d.amount_cents === denomination.amount_cents)}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {denomination.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Amount Input */}
        <div className="flex items-center space-x-3">
          <div className="flex-1">
            <label htmlFor="new-amount" className="sr-only">
              Gift card amount
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 sm:text-sm">$</span>
              </div>
              <input
                type="text"
                id="new-amount"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                onKeyPress={(e) => handleKeyPress(e, handleAddDenomination)}
                className="block w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="0.00"
                disabled={isLoading}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={handleAddDenomination}
            disabled={isLoading || !newAmount.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add Amount
          </button>
        </div>

        {/* Validation Error */}
        {validationError && (
          <p className="mt-2 text-sm text-red-600">{validationError}</p>
        )}

        {/* API Errors */}
        {errors.amount_cents && (
          <p className="mt-2 text-sm text-red-600">{errors.amount_cents}</p>
        )}
        {errors.general && (
          <p className="mt-2 text-sm text-red-600">{errors.general}</p>
        )}
      </div>

      {/* Help Text */}
      <div className="text-sm text-gray-500">
        <p>
          Gift cards can be purchased for any of these amounts and redeemed for services.
          Minimum amount is $5.00, maximum is $1,000.00.
        </p>
      </div>
    </div>
  );
};

