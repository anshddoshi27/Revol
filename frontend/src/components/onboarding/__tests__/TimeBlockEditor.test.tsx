/**
 * TimeBlockEditor Component Tests
 * 
 * Unit tests for the TimeBlockEditor component.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TimeBlockEditor } from '../TimeBlockEditor';
import type { StaffMember, TimeBlock } from '../../../api/types';

// Mock the observability module
jest.mock('../../../observability/step4-availability', () => ({
  onboardingStep4Observability: {
    trackTimeBlockCreated: jest.fn(),
    trackTimeBlockUpdated: jest.fn(),
    trackValidationError: jest.fn(),
  },
}));

// Mock the hook
jest.mock('../../../hooks/useTimeBlockManagement', () => ({
  useTimeBlockManagement: () => ({
    formData: {
      staff_id: '',
      day_of_week: 0,
      start_time: '09:00',
      end_time: '17:00',
      break_start: undefined,
      break_end: undefined,
      is_recurring: true,
    },
    isEditing: false,
    editingBlockId: null,
    validationErrors: [],
    isValid: true,
    updateFormData: jest.fn(),
    saveTimeBlock: jest.fn(() => ({
      id: 'test-id',
      staff_id: 'staff-1',
      day_of_week: 0,
      start_time: '09:00',
      end_time: '17:00',
      is_recurring: true,
      is_active: true,
    })),
    getAvailableStaff: jest.fn(() => mockStaffMembers),
    getStaffById: jest.fn((id) => mockStaffMembers.find(s => s.id === id)),
    formatTimeForDisplay: jest.fn((time) => time),
    calculateBlockDuration: jest.fn(() => 480), // 8 hours in minutes
    hasBreak: false,
    toggleBreak: jest.fn(),
    isBreakValid: true,
  }),
}));

const mockStaffMembers: StaffMember[] = [
  {
    id: 'staff-1',
    name: 'John Doe',
    role: 'Stylist',
    color: '#3B82F6',
  },
  {
    id: 'staff-2',
    name: 'Jane Smith',
    role: 'Manager',
    color: '#10B981',
  },
];

const mockTimeBlocks: TimeBlock[] = [];

describe('TimeBlockEditor', () => {
  const defaultProps = {
    staffMembers: mockStaffMembers,
    existingTimeBlocks: mockTimeBlocks,
    onSave: jest.fn(),
    onCancel: jest.fn(),
    onError: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the time block editor form', () => {
    render(<TimeBlockEditor {...defaultProps} />);
    
    expect(screen.getByText('Add Time Block')).toBeInTheDocument();
    expect(screen.getByLabelText('Staff Member')).toBeInTheDocument();
    expect(screen.getByLabelText('Day of Week')).toBeInTheDocument();
    expect(screen.getByLabelText('Start Time')).toBeInTheDocument();
    expect(screen.getByLabelText('End Time')).toBeInTheDocument();
  });

  it('shows edit mode when initial data is provided', () => {
    const initialData: Partial<TimeBlock> = {
      id: 'test-id',
      staff_id: 'staff-1',
      day_of_week: 1,
      start_time: '10:00',
      end_time: '18:00',
    };

    render(<TimeBlockEditor {...defaultProps} initialData={initialData} />);
    
    expect(screen.getByText('Edit Time Block')).toBeInTheDocument();
  });

  it('populates staff member options', () => {
    render(<TimeBlockEditor {...defaultProps} />);
    
    const staffSelect = screen.getByLabelText('Staff Member');
    fireEvent.click(staffSelect);
    
    expect(screen.getByText('John Doe - Stylist')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith - Manager')).toBeInTheDocument();
  });

  it('populates day of week options', () => {
    render(<TimeBlockEditor {...defaultProps} />);
    
    const daySelect = screen.getByLabelText('Day of Week');
    fireEvent.click(daySelect);
    
    expect(screen.getByText('Sunday')).toBeInTheDocument();
    expect(screen.getByText('Monday')).toBeInTheDocument();
    expect(screen.getByText('Tuesday')).toBeInTheDocument();
  });

  it('populates time slot options', () => {
    render(<TimeBlockEditor {...defaultProps} />);
    
    const startTimeSelect = screen.getByLabelText('Start Time');
    fireEvent.click(startTimeSelect);
    
    expect(screen.getByText('6:00 AM')).toBeInTheDocument();
    expect(screen.getByText('9:00 AM')).toBeInTheDocument();
    expect(screen.getByText('12:00 PM')).toBeInTheDocument();
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<TimeBlockEditor {...defaultProps} />);
    
    const cancelButton = screen.getByText('Cancel');
    await user.click(cancelButton);
    
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onSave when form is submitted with valid data', async () => {
    const user = userEvent.setup();
    render(<TimeBlockEditor {...defaultProps} />);
    
    const saveButton = screen.getByText('Create Time Block');
    await user.click(saveButton);
    
    expect(defaultProps.onSave).toHaveBeenCalledTimes(1);
  });

  it('shows break management section', () => {
    render(<TimeBlockEditor {...defaultProps} />);
    
    expect(screen.getByText('Break Time')).toBeInTheDocument();
    expect(screen.getByText('Add Break')).toBeInTheDocument();
  });

  it('shows recurring option', () => {
    render(<TimeBlockEditor {...defaultProps} />);
    
    expect(screen.getByText('Recurring weekly')).toBeInTheDocument();
    expect(screen.getByLabelText('Recurring weekly')).toBeInTheDocument();
  });

  it('shows duration calculation', () => {
    render(<TimeBlockEditor {...defaultProps} />);
    
    expect(screen.getByText('Duration: 8h 0m')).toBeInTheDocument();
  });

  it('handles form validation errors', () => {
    // Mock the hook to return validation errors
    jest.doMock('../../../hooks/useTimeBlockManagement', () => ({
      useTimeBlockManagement: () => ({
        formData: {
          staff_id: '',
          day_of_week: 0,
          start_time: '09:00',
          end_time: '17:00',
          break_start: undefined,
          break_end: undefined,
          is_recurring: true,
        },
        isEditing: false,
        editingBlockId: null,
        validationErrors: ['Staff member is required', 'Invalid time range'],
        isValid: false,
        updateFormData: jest.fn(),
        saveTimeBlock: jest.fn(),
        getAvailableStaff: jest.fn(() => mockStaffMembers),
        getStaffById: jest.fn(),
        formatTimeForDisplay: jest.fn((time) => time),
        calculateBlockDuration: jest.fn(() => 480),
        hasBreak: false,
        toggleBreak: jest.fn(),
        isBreakValid: true,
      }),
    }));

    render(<TimeBlockEditor {...defaultProps} />);
    
    expect(screen.getByText('Please fix the following errors:')).toBeInTheDocument();
    expect(screen.getByText('• Staff member is required')).toBeInTheDocument();
    expect(screen.getByText('• Invalid time range')).toBeInTheDocument();
  });

  it('disables save button when form is invalid', () => {
    // Mock the hook to return invalid state
    jest.doMock('../../../hooks/useTimeBlockManagement', () => ({
      useTimeBlockManagement: () => ({
        formData: {
          staff_id: '',
          day_of_week: 0,
          start_time: '09:00',
          end_time: '17:00',
          break_start: undefined,
          break_end: undefined,
          is_recurring: true,
        },
        isEditing: false,
        editingBlockId: null,
        validationErrors: ['Staff member is required'],
        isValid: false,
        updateFormData: jest.fn(),
        saveTimeBlock: jest.fn(),
        getAvailableStaff: jest.fn(() => mockStaffMembers),
        getStaffById: jest.fn(),
        formatTimeForDisplay: jest.fn((time) => time),
        calculateBlockDuration: jest.fn(() => 480),
        hasBreak: false,
        toggleBreak: jest.fn(),
        isBreakValid: true,
      }),
    }));

    render(<TimeBlockEditor {...defaultProps} />);
    
    const saveButton = screen.getByText('Create Time Block');
    expect(saveButton).toBeDisabled();
  });
});
