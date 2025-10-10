/**
 * TimeBlockEditor Component
 * 
 * Component for creating and editing time blocks in the availability calendar.
 * Provides form fields for time selection, break management, and validation.
 */

import React, { useState, useEffect } from 'react';
import { Clock, User, Calendar, Coffee, RotateCcw, Save, X, AlertCircle } from 'lucide-react';
import { useTimeBlockManagement } from '../../hooks/useTimeBlockManagement';
import type { TimeBlock, StaffMember } from '../../api/types';
import { DAYS_OF_WEEK, COMMON_TIME_SLOTS } from '../../api/types/availability';

interface TimeBlockEditorProps {
  staffMembers: StaffMember[];
  existingTimeBlocks: TimeBlock[];
  initialData?: Partial<TimeBlock>;
  onSave: (timeBlock: TimeBlock) => void;
  onCancel: () => void;
  onError?: (error: Error) => void;
  className?: string;
}

export const TimeBlockEditor: React.FC<TimeBlockEditorProps> = ({
  staffMembers,
  existingTimeBlocks,
  initialData,
  onSave,
  onCancel,
  onError,
  className = '',
}) => {
  const {
    formData,
    isEditing,
    validationErrors,
    isValid,
    updateFormData,
    saveTimeBlock,
    getAvailableStaff,
    getStaffById,
    formatTimeForDisplay,
    calculateBlockDuration,
    hasBreak,
    toggleBreak,
    isBreakValid,
  } = useTimeBlockManagement({
    staffMembers,
    existingTimeBlocks,
    onTimeBlockChange: onSave,
    onError,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form data if provided
  useEffect(() => {
    if (initialData) {
      updateFormData({
        staff_id: initialData.staff_id || '',
        day_of_week: initialData.day_of_week || 0,
        start_time: initialData.start_time || '09:00',
        end_time: initialData.end_time || '17:00',
        break_start: initialData.break_start,
        break_end: initialData.break_end,
        is_recurring: initialData.is_recurring ?? true,
      });
    }
  }, [initialData, updateFormData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isValid) return;
    
    setIsSubmitting(true);
    try {
      const timeBlock = saveTimeBlock();
      if (timeBlock) {
        onSave(timeBlock);
      }
    } catch (error) {
      onError?.(error as Error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedStaff = getStaffById(formData.staff_id);
  const availableStaff = getAvailableStaff();
  const duration = calculateBlockDuration();

  return (
    <div className={`bg-white rounded-lg border border-gray-200 shadow-lg p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-600" />
          {initialData ? 'Edit Time Block' : 'Add Time Block'}
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
            <User className="w-4 h-4 inline mr-1" />
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
            <Calendar className="w-4 h-4 inline mr-1" />
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

        {/* Duration Display */}
        {duration > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <div className="flex items-center gap-2 text-sm text-blue-800">
              <Clock className="w-4 h-4" />
              <span>Duration: {Math.floor(duration / 60)}h {duration % 60}m</span>
            </div>
          </div>
        )}

        {/* Break Management */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-gray-700">
              <Coffee className="w-4 h-4 inline mr-1" />
              Break Time
            </label>
            <button
              type="button"
              onClick={toggleBreak}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                hasBreak
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {hasBreak ? 'Remove Break' : 'Add Break'}
            </button>
          </div>

          {hasBreak && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="break_start" className="block text-sm font-medium text-gray-700 mb-2">
                  Break Start
                </label>
                <select
                  id="break_start"
                  value={formData.break_start || ''}
                  onChange={(e) => updateFormData({ break_start: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select time</option>
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
                  value={formData.break_end || ''}
                  onChange={(e) => updateFormData({ break_end: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select time</option>
                  {COMMON_TIME_SLOTS.map((time) => (
                    <option key={time} value={time}>
                      {formatTimeForDisplay(time)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {hasBreak && !isBreakValid && (
            <div className="mt-2 flex items-center gap-2 text-sm text-red-600">
              <AlertCircle className="w-4 h-4" />
              <span>Break time must be within the time block</span>
            </div>
          )}
        </div>

        {/* Recurring Option */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="is_recurring"
            checked={formData.is_recurring}
            onChange={(e) => updateFormData({ is_recurring: e.target.checked })}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="is_recurring" className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <RotateCcw className="w-4 h-4" />
            Recurring weekly
          </label>
        </div>

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
                {initialData ? 'Update' : 'Create'} Time Block
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
