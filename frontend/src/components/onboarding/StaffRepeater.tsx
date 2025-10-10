/**
 * StaffRepeater Component
 * 
 * Form component for managing staff members with auto-assigned colors.
 */

import React, { useState } from 'react';
import type { StaffMember } from '../../api/types/onboarding';

interface StaffRepeaterProps {
  staff: StaffMember[];
  onAdd: (staff: Omit<StaffMember, 'id' | 'color'>) => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, updates: Partial<StaffMember>) => void;
  errors?: Record<string, string>;
}

export const StaffRepeater: React.FC<StaffRepeaterProps> = ({
  staff,
  onAdd,
  onRemove,
  onUpdate,
  errors = {},
}) => {
  const [newStaff, setNewStaff] = useState({ role: '', name: '' });

  const handleAddStaff = () => {
    if (newStaff.role.trim() && newStaff.name.trim()) {
      onAdd(newStaff);
      setNewStaff({ role: '', name: '' });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddStaff();
    }
  };

  const commonRoles = [
    'Owner',
    'Manager',
    'Stylist',
    'Therapist',
    'Trainer',
    'Instructor',
    'Consultant',
    'Assistant',
    'Receptionist',
    'Other',
  ];

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">
        Add your team members. You can always add more later.
      </div>

      {/* Existing staff members */}
      {staff.map((member, index) => (
        <div
          key={member.id || index}
          className="flex items-center space-x-3 rounded-lg border border-gray-200 bg-gray-50 p-3"
        >
          <div
            className="h-8 w-8 rounded-full flex-shrink-0"
            style={{ backgroundColor: member.color }}
            title={`Color: ${member.color}`}
          />
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={member.role}
                onChange={(e) => onUpdate(index, { role: e.target.value })}
                className="block w-32 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="Role"
              />
              <input
                type="text"
                value={member.name}
                onChange={(e) => onUpdate(index, { name: e.target.value })}
                className="block flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="Name"
              />
            </div>
            
            {(errors[`staff.${index}.role`] || errors[`staff.${index}.name`]) && (
              <div className="mt-1 text-sm text-red-600">
                {errors[`staff.${index}.role`] || errors[`staff.${index}.name`]}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => onRemove(index)}
            className="flex-shrink-0 rounded-md p-1 text-gray-400 hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-red-500"
            aria-label={`Remove ${member.name || 'staff member'}`}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}

      {/* Add new staff member */}
      <div className="rounded-lg border-2 border-dashed border-gray-300 p-4">
        <div className="text-sm font-medium text-gray-700 mb-3">Add Team Member</div>
        
        <div className="space-y-3">
          <div>
            <label htmlFor="new-staff-role" className="block text-sm font-medium text-gray-700">
              Role
            </label>
            <select
              id="new-staff-role"
              value={newStaff.role}
              onChange={(e) => setNewStaff(prev => ({ ...prev, role: e.target.value }))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="">Select a role</option>
              {commonRoles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="new-staff-name" className="block text-sm font-medium text-gray-700">
              Name
            </label>
            <input
              type="text"
              id="new-staff-name"
              value={newStaff.name}
              onChange={(e) => setNewStaff(prev => ({ ...prev, name: e.target.value }))}
              onKeyDown={handleKeyDown}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="Enter team member's name"
            />
          </div>

          <button
            type="button"
            onClick={handleAddStaff}
            disabled={!newStaff.role.trim() || !newStaff.name.trim()}
            className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Add Team Member
          </button>
        </div>
      </div>

      {staff.length === 0 && (
        <div className="text-center py-6 text-gray-500">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No team members yet</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by adding your first team member above.</p>
        </div>
      )}
    </div>
  );
};
