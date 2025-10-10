/**
 * ChipsConfigurator Component
 * 
 * Component for configuring special requests settings including
 * quick chips, length limits, and custom input options.
 */

import React, { useState, useCallback } from 'react';
import type { ChipsConfiguration } from '../../api/types/services';
import { COMMON_QUICK_CHIPS, MAX_QUICK_CHIPS, MAX_SPECIAL_REQUESTS_LENGTH } from '../../api/types/services';

interface ChipsConfiguratorProps {
  initialConfig?: ChipsConfiguration;
  onConfigChange?: (config: ChipsConfiguration) => void;
  disabled?: boolean;
}

interface ChipInputProps {
  value: string;
  onChange: (value: string) => void;
  onRemove: () => void;
  placeholder?: string;
  disabled?: boolean;
}

const ChipInput: React.FC<ChipInputProps> = ({ value, onChange, onRemove, placeholder, disabled = false }) => {
  const [isEditing, setIsEditing] = useState(!value);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (value.trim()) {
        setIsEditing(false);
      }
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  }, [value]);

  const handleBlur = useCallback(() => {
    if (value.trim()) {
      setIsEditing(false);
    }
  }, [value]);

  if (!isEditing) {
    return (
      <div className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
        <span className="mr-2">{value}</span>
        <button
          onClick={onRemove}
          disabled={disabled}
          className="text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded"
          aria-label={`Remove ${value}`}
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      placeholder={placeholder}
      disabled={disabled}
      className="inline-block px-3 py-1 text-sm border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      autoFocus
    />
  );
};

interface QuickChipsSelectorProps {
  selectedChips: string[];
  onChipsChange: (chips: string[]) => void;
  disabled?: boolean;
}

const QuickChipsSelector: React.FC<QuickChipsSelectorProps> = ({ selectedChips, onChipsChange, disabled = false }) => {
  const handleChipToggle = useCallback((chip: string) => {
    if (disabled) return;

    if (selectedChips.includes(chip)) {
      onChipsChange(selectedChips.filter(c => c !== chip));
    } else if (selectedChips.length < MAX_QUICK_CHIPS) {
      onChipsChange([...selectedChips, chip]);
    }
  }, [selectedChips, onChipsChange, disabled]);

  const availableChips = COMMON_QUICK_CHIPS.filter(chip => !selectedChips.includes(chip));

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">
          Common Options ({selectedChips.length}/{MAX_QUICK_CHIPS})
        </h4>
        <div className="flex flex-wrap gap-2">
          {COMMON_QUICK_CHIPS.map((chip) => (
            <button
              key={chip}
              onClick={() => handleChipToggle(chip)}
              disabled={disabled || (!selectedChips.includes(chip) && selectedChips.length >= MAX_QUICK_CHIPS)}
              className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                selectedChips.includes(chip)
                  ? 'bg-blue-100 text-blue-800 border-blue-200'
                  : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
              } disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1`}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {availableChips.length > 0 && selectedChips.length < MAX_QUICK_CHIPS && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Available Options
          </h4>
          <div className="flex flex-wrap gap-2">
            {availableChips.slice(0, 10).map((chip) => (
              <button
                key={chip}
                onClick={() => handleChipToggle(chip)}
                disabled={disabled}
                className="px-3 py-1 text-sm rounded-full bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                + {chip}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const ChipsConfigurator: React.FC<ChipsConfiguratorProps> = ({
  initialConfig = {
    enabled: false,
    limit: 200,
    quick_chips: [],
    allow_custom: true,
  },
  onConfigChange,
  disabled = false,
}) => {
  const [config, setConfig] = useState<ChipsConfiguration>(initialConfig);
  const [customChipInput, setCustomChipInput] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateConfig = useCallback((updates: Partial<ChipsConfiguration>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    onConfigChange?.(newConfig);
  }, [config, onConfigChange]);

  const handleEnabledToggle = useCallback(() => {
    if (disabled) return;
    updateConfig({ enabled: !config.enabled });
  }, [disabled, config.enabled, updateConfig]);

  const handleLimitChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    
    const value = parseInt(e.target.value, 10);
    if (isNaN(value) || value < 10 || value > MAX_SPECIAL_REQUESTS_LENGTH) {
      setErrors(prev => ({ ...prev, limit: `Limit must be between 10 and ${MAX_SPECIAL_REQUESTS_LENGTH} characters` }));
      return;
    }

    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.limit;
      return newErrors;
    });

    updateConfig({ limit: value });
  }, [disabled, updateConfig]);

  const handleAllowCustomToggle = useCallback(() => {
    if (disabled) return;
    updateConfig({ allow_custom: !config.allow_custom });
  }, [disabled, config.allow_custom, updateConfig]);

  const handleQuickChipsChange = useCallback((chips: string[]) => {
    if (disabled) return;
    updateConfig({ quick_chips: chips });
  }, [disabled, updateConfig]);

  const handleAddCustomChip = useCallback(() => {
    if (disabled || !customChipInput.trim()) return;

    const trimmedChip = customChipInput.trim();
    
    if (config.quick_chips.includes(trimmedChip)) {
      setErrors(prev => ({ ...prev, customChip: 'This option already exists' }));
      return;
    }

    if (config.quick_chips.length >= MAX_QUICK_CHIPS) {
      setErrors(prev => ({ ...prev, customChip: `Maximum ${MAX_QUICK_CHIPS} options allowed` }));
      return;
    }

    if (trimmedChip.length > 50) {
      setErrors(prev => ({ ...prev, customChip: 'Option text cannot exceed 50 characters' }));
      return;
    }

    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.customChip;
      return newErrors;
    });

    updateConfig({ quick_chips: [...config.quick_chips, trimmedChip] });
    setCustomChipInput('');
  }, [disabled, customChipInput, config.quick_chips, updateConfig]);

  const handleRemoveCustomChip = useCallback((chipToRemove: string) => {
    if (disabled) return;
    updateConfig({ quick_chips: config.quick_chips.filter(chip => chip !== chipToRemove) });
  }, [disabled, config.quick_chips, updateConfig]);

  const handleCustomChipKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddCustomChip();
    }
  }, [handleAddCustomChip]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-medium text-gray-900">Special Requests Configuration</h3>
        <p className="text-sm text-gray-500 mt-1">
          Configure how customers can add special requests or notes to their bookings
        </p>
      </div>

      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium text-gray-700">Enable Special Requests</h4>
          <p className="text-sm text-gray-500">Allow customers to add special requests or notes</p>
        </div>
        <button
          onClick={handleEnabledToggle}
          disabled={disabled}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
            config.enabled ? 'bg-blue-600' : 'bg-gray-200'
          }`}
          aria-label="Enable Special Requests"
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              config.enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {config.enabled && (
        <>
          {/* Character Limit */}
          <div>
            <label htmlFor="character-limit" className="block text-sm font-medium text-gray-700">
              Character Limit
            </label>
            <div className="mt-1 flex items-center space-x-2">
              <input
                id="character-limit"
                type="number"
                min="10"
                max={MAX_SPECIAL_REQUESTS_LENGTH}
                value={config.limit || 200}
                onChange={handleLimitChange}
                disabled={disabled}
                className={`block w-24 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                  errors.limit ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              />
              <span className="text-sm text-gray-500">characters</span>
            </div>
            {errors.limit && (
              <p className="mt-1 text-sm text-red-600" role="alert">
                {errors.limit}
              </p>
            )}
            <p className="mt-1 text-sm text-gray-500">
              Maximum number of characters customers can enter
            </p>
          </div>

          {/* Allow Custom Input */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-700">Allow Custom Input</h4>
              <p className="text-sm text-gray-500">Let customers type their own requests</p>
            </div>
            <button
              onClick={handleAllowCustomToggle}
              disabled={disabled}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                config.allow_custom ? 'bg-blue-600' : 'bg-gray-200'
              }`}
              aria-label="Allow Custom Input"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  config.allow_custom ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Quick Chips */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Quick Options</h4>
            <p className="text-sm text-gray-500 mb-4">
              Pre-defined options customers can select from (up to {MAX_QUICK_CHIPS})
            </p>
            
            <QuickChipsSelector
              selectedChips={config.quick_chips}
              onChipsChange={handleQuickChipsChange}
              disabled={disabled}
            />

            {/* Selected Chips Display */}
            {config.quick_chips.length > 0 && (
              <div className="mt-4">
                <h5 className="text-sm font-medium text-gray-700 mb-2">Selected Options</h5>
                <div className="flex flex-wrap gap-2">
                  {config.quick_chips.map((chip) => (
                    <ChipInput
                      key={chip}
                      value={chip}
                      onChange={() => {}} // Read-only for selected chips
                      onRemove={() => handleRemoveCustomChip(chip)}
                      disabled={disabled}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Add Custom Chip */}
            {config.allow_custom && config.quick_chips.length < MAX_QUICK_CHIPS && (
              <div className="mt-4">
                <h5 className="text-sm font-medium text-gray-700 mb-2">Add Custom Option</h5>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={customChipInput}
                    onChange={(e) => setCustomChipInput(e.target.value)}
                    onKeyDown={handleCustomChipKeyDown}
                    placeholder="Enter custom option..."
                    disabled={disabled}
                    maxLength={50}
                    className={`flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                      errors.customChip ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  />
                  <button
                    onClick={handleAddCustomChip}
                    disabled={disabled || !customChipInput.trim()}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
                </div>
                {errors.customChip && (
                  <p className="mt-1 text-sm text-red-600" role="alert">
                    {errors.customChip}
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Preview */}
      {config.enabled && (
        <div className="border-t border-gray-200 pt-6">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Preview</h4>
          <div className="bg-gray-50 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Special Requests
            </label>
            
            {config.quick_chips.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-gray-500 mb-2">Quick options:</p>
                <div className="flex flex-wrap gap-1">
                  {config.quick_chips.slice(0, 3).map((chip) => (
                    <span
                      key={chip}
                      className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-800"
                    >
                      {chip}
                    </span>
                  ))}
                  {config.quick_chips.length > 3 && (
                    <span className="text-xs text-gray-500">
                      +{config.quick_chips.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {config.allow_custom && (
              <textarea
                placeholder="Add any special requests or notes..."
                disabled
                rows={3}
                maxLength={config.limit}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:opacity-50"
              />
            )}

            <p className="mt-1 text-xs text-gray-500">
              {config.limit} character limit
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
