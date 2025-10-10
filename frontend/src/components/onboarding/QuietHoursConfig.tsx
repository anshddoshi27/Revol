/**
 * QuietHoursConfig Component
 * 
 * Component for configuring quiet hours settings for notifications.
 * Allows setting start/end times and timezone for when notifications should not be sent.
 */

import React, { useState, useCallback, useEffect } from 'react';
import type { QuietHoursConfig, UpdateQuietHoursRequest } from '../../api/types/notifications';

interface QuietHoursConfigProps {
  initialConfig?: QuietHoursConfig;
  onConfigChange: (config: UpdateQuietHoursRequest) => void;
  className?: string;
  disabled?: boolean;
  showTimezone?: boolean;
  showPolicyNote?: boolean;
}

export const QuietHoursConfig: React.FC<QuietHoursConfigProps> = ({
  initialConfig = {
    enabled: false,
    start_time: '22:00',
    end_time: '08:00',
    timezone: 'America/New_York',
  },
  onConfigChange,
  className = '',
  disabled = false,
  showTimezone = true,
  showPolicyNote = true,
}) => {
  const [config, setConfig] = useState<QuietHoursConfig>(initialConfig);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Update parent when config changes
  useEffect(() => {
    onConfigChange({
      enabled: config.enabled,
      start_time: config.start_time,
      end_time: config.end_time,
      timezone: config.timezone,
    });
  }, [config, onConfigChange]);

  // Update config field
  const updateConfig = useCallback((field: keyof QuietHoursConfig, value: any) => {
    setConfig(prev => ({
      ...prev,
      [field]: value,
    }));

    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  }, [errors]);

  // Validate time format
  const validateTime = useCallback((time: string): boolean => {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  }, []);

  // Validate time range
  const validateTimeRange = useCallback((startTime: string, endTime: string): boolean => {
    if (!validateTime(startTime) || !validateTime(endTime)) {
      return false;
    }

    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    // Allow overnight ranges (e.g., 22:00 to 08:00)
    if (startMinutes > endMinutes) {
      return true; // Overnight range is valid
    }

    // For same-day ranges, ensure there's at least 1 hour difference
    return endMinutes - startMinutes >= 60;
  }, [validateTime]);

  // Handle time change with validation
  const handleTimeChange = useCallback((field: 'start_time' | 'end_time', value: string) => {
    if (!validateTime(value)) {
      setErrors(prev => ({
        ...prev,
        [field]: 'Please enter a valid time in HH:MM format',
      }));
      return;
    }

    const otherField = field === 'start_time' ? 'end_time' : 'start_time';
    const otherTime = field === 'start_time' ? config.end_time : config.start_time;

    if (!validateTimeRange(field === 'start_time' ? value : otherTime, field === 'end_time' ? value : otherTime)) {
      setErrors(prev => ({
        ...prev,
        [field]: 'Invalid time range. Please ensure at least 1 hour difference or use overnight range.',
      }));
      return;
    }

    updateConfig(field, value);
  }, [config.start_time, config.end_time, validateTime, validateTimeRange, updateConfig]);

  // Get time options for select
  const getTimeOptions = useCallback(() => {
    const options = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const displayTime = new Date(2000, 0, 1, hour, minute).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
        options.push({ value: timeString, label: displayTime });
      }
    }
    return options;
  }, []);

  // Get common timezones
  const getTimezoneOptions = useCallback(() => {
    return [
      { value: 'America/New_York', label: 'Eastern Time (ET)' },
      { value: 'America/Chicago', label: 'Central Time (CT)' },
      { value: 'America/Denver', label: 'Mountain Time (MT)' },
      { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
      { value: 'America/Phoenix', label: 'Arizona Time (MST)' },
      { value: 'America/Anchorage', label: 'Alaska Time (AKST)' },
      { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST)' },
      { value: 'UTC', label: 'UTC' },
    ];
  }, []);

  // Format time for display
  const formatTimeForDisplay = useCallback((time: string): string => {
    const [hour, minute] = time.split(':').map(Number);
    return new Date(2000, 0, 1, hour, minute).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }, []);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">
            Quiet Hours
          </h3>
          <p className="text-sm text-gray-500">
            Set times when notifications should not be sent to customers
          </p>
        </div>
        <button
          type="button"
          onClick={() => updateConfig('enabled', !config.enabled)}
          disabled={disabled}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            config.enabled ? 'bg-blue-600' : 'bg-gray-200'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              config.enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Configuration */}
      {config.enabled && (
        <div className="space-y-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          {/* Time Range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Start Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Time
              </label>
              <select
                value={config.start_time}
                onChange={(e) => handleTimeChange('start_time', e.target.value)}
                disabled={disabled}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                  errors.start_time ? 'border-red-300' : 'border-gray-300'
                } ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
              >
                {getTimeOptions().map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {errors.start_time && (
                <p className="mt-1 text-sm text-red-600">{errors.start_time}</p>
              )}
            </div>

            {/* End Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Time
              </label>
              <select
                value={config.end_time}
                onChange={(e) => handleTimeChange('end_time', e.target.value)}
                disabled={disabled}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                  errors.end_time ? 'border-red-300' : 'border-gray-300'
                } ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
              >
                {getTimeOptions().map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {errors.end_time && (
                <p className="mt-1 text-sm text-red-600">{errors.end_time}</p>
              )}
            </div>
          </div>

          {/* Timezone */}
          {showTimezone && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Timezone
              </label>
              <select
                value={config.timezone}
                onChange={(e) => updateConfig('timezone', e.target.value)}
                disabled={disabled}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                  errors.timezone ? 'border-red-300' : 'border-gray-300'
                } ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
              >
                {getTimezoneOptions().map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {errors.timezone && (
                <p className="mt-1 text-sm text-red-600">{errors.timezone}</p>
              )}
            </div>
          )}

          {/* Time Range Summary */}
          <div className="bg-white border border-gray-200 rounded-md p-3">
            <h4 className="text-sm font-medium text-gray-900 mb-2">
              Quiet Hours Summary
            </h4>
            <p className="text-sm text-gray-600">
              Notifications will be paused from{' '}
              <span className="font-medium">{formatTimeForDisplay(config.start_time)}</span>
              {' '}to{' '}
              <span className="font-medium">{formatTimeForDisplay(config.end_time)}</span>
              {' '}({config.timezone})
            </p>
          </div>
        </div>
      )}

      {/* Policy Note */}
      {showPolicyNote && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                Quiet Hours Policy
              </h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>
                  During quiet hours, notifications will be queued and sent when the quiet period ends. 
                  This helps respect your customers' sleep schedules and local regulations.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Disabled State Message */}
      {!config.enabled && (
        <div className="text-center py-4 text-sm text-gray-500">
          <p>Quiet hours are disabled. Notifications will be sent immediately.</p>
        </div>
      )}
    </div>
  );
};
