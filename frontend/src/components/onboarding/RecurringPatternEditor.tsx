/**
 * RecurringPatternEditor Component
 * 
 * Component for creating and editing recurring availability patterns.
 * Provides options for weekly, biweekly, and monthly recurring schedules.
 */

import React, { useState, useEffect } from 'react';
import { RotateCcw, Calendar, Clock, Save, X, AlertCircle, Info } from 'lucide-react';
import type { RecurringPatternFormData, StaffMember } from '../../api/types';
import { DAYS_OF_WEEK, COMMON_TIME_SLOTS } from '../../api/types/availability';

interface RecurringPatternEditorProps {
  staffMembers: StaffMember[];
  initialData?: Partial<RecurringPatternFormData>;
  onSave: (pattern: RecurringPatternFormData) => void;
  onCancel: () => void;
  onError?: (error: Error) => void;
  className?: string;
}

export const RecurringPatternEditor: React.FC<RecurringPatternEditorProps> = ({
  staffMembers,
  initialData,
  onSave,
  onCancel,
  onError,
  className = '',
}) => {
  const [formData, setFormData] = useState<RecurringPatternFormData>({
    staff_id: '',
    day_of_week: 0,
    start_time: '09:00',
    end_time: '17:00',
    break_start: undefined,
    break_end: undefined,
    pattern_type: 'weekly',
    end_date: undefined,
  });

  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form data if provided
  useEffect(() => {
    if (initialData) {
      setFormData(prev => ({ ...prev, ...initialData }));
    }
  }, [initialData]);

  // Validation
  useEffect(() => {
    const errors: string[] = [];

    // Required fields
    if (!formData.staff_id) {
      errors.push('Staff member is required');
    }

    if (!formData.start_time) {
      errors.push('Start time is required');
    }

    if (!formData.end_time) {
      errors.push('End time is required');
    }

    // Time format validation
    if (formData.start_time && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(formData.start_time)) {
      errors.push('Invalid start time format');
    }

    if (formData.end_time && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(formData.end_time)) {
      errors.push('Invalid end time format');
    }

    // Time range validation
    if (formData.start_time && formData.end_time) {
      const startMinutes = parseInt(formData.start_time.split(':')[0]) * 60 + parseInt(formData.start_time.split(':')[1]);
      const endMinutes = parseInt(formData.end_time.split(':')[0]) * 60 + parseInt(formData.end_time.split(':')[1]);

      if (startMinutes >= endMinutes) {
        errors.push('End time must be after start time');
      }

      if (endMinutes - startMinutes < 30) {
        errors.push('Time block must be at least 30 minutes long');
      }
    }

    // Break validation
    if (formData.break_start && formData.break_end) {
      const breakStartMinutes = parseInt(formData.break_start.split(':')[0]) * 60 + parseInt(formData.break_start.split(':')[1]);
      const breakEndMinutes = parseInt(formData.break_end.split(':')[0]) * 60 + parseInt(formData.break_end.split(':')[1]);

      if (breakStartMinutes >= breakEndMinutes) {
        errors.push('Break end time must be after break start time');
      }

      if (formData.start_time && formData.end_time) {
        const startMinutes = parseInt(formData.start_time.split(':')[0]) * 60 + parseInt(formData.start_time.split(':')[1]);
        const endMinutes = parseInt(formData.end_time.split(':')[0]) * 60 + parseInt(formData.end_time.split(':')[1]);

        if (breakStartMinutes < startMinutes || breakEndMinutes > endMinutes) {
          errors.push('Break must be within the time block');
        }
      }
    }

    // End date validation
    if (formData.end_date) {
      const endDate = new Date(formData.end_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (endDate < today) {
        errors.push('End date cannot be in the past');
      }
    }

    setValidationErrors(errors);
  }, [formData]);

  const isValid = validationErrors.length === 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValid) return;

    setIsSubmitting(true);
    try {
      onSave(formData);
    } catch (error) {
      onError?.(error as Error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateFormData = (updates: Partial<RecurringPatternFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const formatTimeForDisplay = (time: string): string => {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const selectedStaff = staffMembers.find(staff => staff.id === formData.staff_id);
  const availableStaff = staffMembers.filter(staff => staff.id && staff.name);

  return (
    <div className={`bg-white rounded-lg border border-gray-200 shadow-lg p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <RotateCcw className="w-5 h-5 text-blue-600" />
          {initialData ? 'Edit Recurring Pattern' : 'Add Recurring Pattern'}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Staff Selection */}
        <div>
          <label htmlFor="staff_id" className="block text-sm font-medium text-gray-700 mb-2">
            Staff Member
          </label>
          <select
            id="staff_id"
            value={formData.staff_id}
            onChange={(e) => updateFormData({ staff_id: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          >
            <option value="">Select a staff member</option>
            {availableStaff.map((staff) => (
              <option key={staff.id} value={staff.id}>
                {staff.name} - {staff.role}
              </option>
            ))}
          </select>
        </div>

        {/* Day Selection */}
        <div>
          <label htmlFor="day_of_week" className="block text-sm font-medium text-gray-700 mb-2">
            Day of Week
          </label>
          <select
            id="day_of_week"
            value={formData.day_of_week}
            onChange={(e) => updateFormData({ day_of_week: parseInt(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          >
            {DAYS_OF_WEEK.map((day, index) => (
              <option key={index} value={index}>
                {day}
              </option>
            ))}
          </select>
        </div>

        {/* Time Range */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="start_time" className="block text-sm font-medium text-gray-700 mb-2">
              Start Time
            </label>
            <select
              id="start_time"
              value={formData.start_time}
              onChange={(e) => updateFormData({ start_time: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              {COMMON_TIME_SLOTS.map((time) => (
                <option key={time} value={time}>
                  {formatTimeForDisplay(time)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="end_time" className="block text-sm font-medium text-gray-700 mb-2">
              End Time
            </label>
            <select
              id="end_time"
              value={formData.end_time}
              onChange={(e) => updateFormData({ end_time: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              {COMMON_TIME_SLOTS.map((time) => (
                <option key={time} value={time}>
                  {formatTimeForDisplay(time)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Break Management */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-gray-700">
              Break Time (Optional)
            </label>
            <button
              type="button"
              onClick={() => {
                if (formData.break_start && formData.break_end) {
                  updateFormData({ break_start: undefined, break_end: undefined });
                } else {
                  // Set default break time (1 hour lunch break in the middle)
                  const startMinutes = parseInt(formData.start_time.split(':')[0]) * 60 + parseInt(formData.start_time.split(':')[1]);
                  const endMinutes = parseInt(formData.end_time.split(':')[0]) * 60 + parseInt(formData.end_time.split(':')[1]);
                  const middleMinutes = Math.floor((startMinutes + endMinutes) / 2);
                  const breakStart = Math.floor(middleMinutes / 60).toString().padStart(2, '0') + ':' + 
                                    (middleMinutes % 60).toString().padStart(2, '0');
                  const breakEnd = Math.floor((middleMinutes + 60) / 60).toString().padStart(2, '0') + ':' + 
                                  ((middleMinutes + 60) % 60).toString().padStart(2, '0');
                  updateFormData({ break_start: breakStart, break_end: breakEnd });
                }
              }}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                formData.break_start && formData.break_end
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {formData.break_start && formData.break_end ? 'Remove Break' : 'Add Break'}
            </button>
          </div>

          {formData.break_start && formData.break_end && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="break_start" className="block text-sm font-medium text-gray-700 mb-2">
                  Break Start
                </label>
                <select
                  id="break_start"
                  value={formData.break_start}
                  onChange={(e) => updateFormData({ break_start: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {COMMON_TIME_SLOTS.map((time) => (
                    <option key={time} value={time}>
                      {formatTimeForDisplay(time)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="break_end" className="block text-sm font-medium text-gray-700 mb-2">
                  Break End
                </label>
                <select
                  id="break_end"
                  value={formData.break_end}
                  onChange={(e) => updateFormData({ break_end: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {COMMON_TIME_SLOTS.map((time) => (
                    <option key={time} value={time}>
                      {formatTimeForDisplay(time)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Pattern Type */}
        <div>
          <label htmlFor="pattern_type" className="block text-sm font-medium text-gray-700 mb-2">
            Recurrence Pattern
          </label>
          <select
            id="pattern_type"
            value={formData.pattern_type}
            onChange={(e) => updateFormData({ pattern_type: e.target.value as 'weekly' | 'biweekly' | 'monthly' })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          >
            <option value="weekly">Weekly</option>
            <option value="biweekly">Bi-weekly (Every 2 weeks)</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>

        {/* End Date (Optional) */}
        <div>
          <label htmlFor="end_date" className="block text-sm font-medium text-gray-700 mb-2">
            End Date (Optional)
          </label>
          <input
            type="date"
            id="end_date"
            value={formData.end_date || ''}
            onChange={(e) => updateFormData({ end_date: e.target.value || undefined })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            min={new Date().toISOString().split('T')[0]}
          />
          <p className="mt-1 text-sm text-gray-500">
            Leave empty for indefinite recurrence
          </p>
        </div>

        {/* Pattern Preview */}
        {selectedStaff && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex items-start gap-2">
              <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-medium text-blue-800 mb-2">Pattern Preview</h4>
                <div className="text-sm text-blue-700 space-y-1">
                  <p><strong>Staff:</strong> {selectedStaff.name}</p>
                  <p><strong>Day:</strong> {DAYS_OF_WEEK[formData.day_of_week]}</p>
                  <p><strong>Time:</strong> {formatTimeForDisplay(formData.start_time)} - {formatTimeForDisplay(formData.end_time)}</p>
                  <p><strong>Pattern:</strong> {formData.pattern_type}</p>
                  {formData.break_start && formData.break_end && (
                    <p><strong>Break:</strong> {formatTimeForDisplay(formData.break_start)} - {formatTimeForDisplay(formData.break_end)}</p>
                  )}
                  {formData.end_date && (
                    <p><strong>Ends:</strong> {new Date(formData.end_date).toLocaleDateString()}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-medium text-red-800 mb-2">Please fix the following errors:</h4>
                <ul className="text-sm text-red-700 space-y-1">
                  {validationErrors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!isValid || isSubmitting}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {initialData ? 'Update' : 'Create'} Pattern
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
