/**
 * ColorPicker Component
 * 
 * Color picker component with contrast validation for onboarding Step 2.
 * Provides WCAG AA compliance checking and color scale generation.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Palette, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { useColorContrast } from '../../hooks/useColorContrast';
import type { ContrastValidationResult } from '../../hooks/useColorContrast';

// ===== TYPES =====

interface ColorPickerProps {
  onColorChange: (color: string, contrastResult: ContrastValidationResult | null) => void;
  onError: (error: string) => void;
  initialColor?: string;
  className?: string;
}

interface PresetColor {
  name: string;
  value: string;
  description: string;
}

// ===== CONSTANTS =====

const PRESET_COLORS: PresetColor[] = [
  { name: 'Blue', value: '#3B82F6', description: 'Professional and trustworthy' },
  { name: 'Green', value: '#10B981', description: 'Natural and calming' },
  { name: 'Purple', value: '#8B5CF6', description: 'Creative and luxurious' },
  { name: 'Orange', value: '#F97316', description: 'Energetic and friendly' },
  { name: 'Red', value: '#EF4444', description: 'Bold and attention-grabbing' },
  { name: 'Teal', value: '#06B6D4', description: 'Modern and sophisticated' },
  { name: 'Pink', value: '#EC4899', description: 'Playful and vibrant' },
  { name: 'Indigo', value: '#6366F1', description: 'Deep and professional' },
];

// ===== COMPONENT =====

export const ColorPicker: React.FC<ColorPickerProps> = ({
  onColorChange,
  onError,
  initialColor = '#3B82F6',
  className = '',
}) => {
  const { state, actions } = useColorContrast();
  const [customColor, setCustomColor] = useState(initialColor);
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  // Initialize with initial color
  useEffect(() => {
    actions.setColor(initialColor);
    actions.validateContrast();
  }, [initialColor]); // Remove actions dependency to prevent infinite re-renders

  // Notify parent of color changes
  useEffect(() => {
    onColorChange(state.selectedColor, state.contrastResult);
  }, [state.selectedColor, state.contrastResult]); // Remove onColorChange dependency

  // Notify parent of errors
  useEffect(() => {
    if (state.error) {
      onError(state.error);
    }
  }, [state.error]); // Remove onError dependency

  const handlePresetColorSelect = useCallback((color: string) => {
    actions.setColor(color);
    actions.validateContrast();
    setCustomColor(color);
    setShowCustomPicker(false);
  }, []); // Remove actions dependency

  const handleCustomColorChange = useCallback((color: string) => {
    setCustomColor(color);
    actions.setColor(color);
    actions.validateContrast();
  }, []); // Remove actions dependency

  const handleCustomColorSubmit = useCallback(() => {
    actions.setColor(customColor);
    actions.validateContrast();
    setShowCustomPicker(false);
  }, [customColor]); // Remove actions dependency

  // Render contrast validation result
  const renderContrastResult = () => {
    if (!state.contrastResult) return null;

    const { ratio, level, recommendation, passesAA } = state.contrastResult;

    const getStatusIcon = () => {
      if (passesAA) {
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      }
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    };

    const getStatusColor = () => {
      if (passesAA) return 'text-green-600';
      return 'text-red-600';
    };

    return (
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center">
            {getStatusIcon()}
            <span className={`ml-2 text-sm font-medium ${getStatusColor()}`}>
              Contrast Ratio: {ratio}:1
            </span>
          </div>
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
            level === 'AAA' ? 'bg-green-100 text-green-800' :
            level === 'AA' ? 'bg-blue-100 text-blue-800' :
            'bg-red-100 text-red-800'
          }`}>
            WCAG {level}
          </span>
        </div>
        
        <p className="text-sm text-gray-600">
          {recommendation}
        </p>
      </div>
    );
  };

  // Render preset colors
  const renderPresetColors = () => {
    return (
      <div className="grid grid-cols-4 gap-3">
        {PRESET_COLORS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            onClick={() => handlePresetColorSelect(preset.value)}
            className={`
              relative p-3 rounded-lg border-2 transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500
              ${state.selectedColor === preset.value 
                ? 'border-blue-500 ring-2 ring-blue-200' 
                : 'border-gray-200 hover:border-gray-300'
              }
            `}
            style={{ backgroundColor: preset.value }}
            aria-label={`Select ${preset.name} color`}
          >
            {state.selectedColor === preset.value && (
              <CheckCircle className="absolute -top-1 -right-1 h-5 w-5 text-white bg-blue-500 rounded-full" />
            )}
            <div className="text-xs text-white font-medium text-center mt-2">
              {preset.name}
            </div>
          </button>
        ))}
      </div>
    );
  };

  // Render custom color picker
  const renderCustomColorPicker = () => {
    if (!showCustomPicker) {
      return (
        <button
          type="button"
          onClick={() => setShowCustomPicker(true)}
          className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        >
          <div className="flex items-center justify-center">
            <Palette className="h-5 w-5 text-gray-400 mr-2" />
            <span className="text-sm text-gray-600">Choose custom color</span>
          </div>
        </button>
      );
    }

    return (
      <div className="space-y-3">
        <div className="flex items-center space-x-3">
          <input
            type="color"
            value={customColor}
            onChange={(e) => handleCustomColorChange(e.target.value)}
            className="w-12 h-12 border border-gray-300 rounded-lg cursor-pointer"
            aria-label="Custom color picker"
          />
          <input
            type="text"
            value={customColor}
            onChange={(e) => handleCustomColorChange(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="#000000"
            pattern="^#[0-9A-Fa-f]{6}$"
          />
          <button
            type="button"
            onClick={handleCustomColorSubmit}
            className="px-4 py-2 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            Apply
          </button>
        </div>
        
        <button
          type="button"
          onClick={() => setShowCustomPicker(false)}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
      </div>
    );
  };

  return (
    <div className={className}>
      <div className="mb-4">
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Choose your brand color
        </h3>
        <p className="text-sm text-gray-600">
          Select a primary color that represents your brand. We'll ensure it meets accessibility standards.
        </p>
      </div>

      {/* Preset colors */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Popular colors</h4>
        {renderPresetColors()}
      </div>

      {/* Custom color picker */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Custom color</h4>
        {renderCustomColorPicker()}
      </div>

      {/* Contrast validation */}
      {renderContrastResult()}

      {/* Accessibility info */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <div className="flex items-start">
          <Info className="h-4 w-4 text-blue-500 mt-0.5 mr-2 flex-shrink-0" />
          <div className="text-sm text-blue-700">
            <p className="font-medium mb-1">Accessibility Standards</p>
            <p>
              We check your color against WCAG AA standards (4.5:1 contrast ratio) 
              to ensure your brand is accessible to all customers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
