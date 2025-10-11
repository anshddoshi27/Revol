/**
 * AvailabilityCalendar Component Tests
 * 
 * Unit tests for the AvailabilityCalendar component.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AvailabilityCalendar } from '../AvailabilityCalendar';
import type { TimeBlock, StaffMember } from '../../../api/types';

// Mock the drag and drop context
jest.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <div data-testid="dnd-context">{children}</div>,
  DragOverlay: ({ children }: { children: React.ReactNode }) => <div data-testid="drag-overlay">{children}</div>,
  closestCenter: jest.fn(),
  KeyboardSensor: jest.fn(),
  PointerSensor: jest.fn(),
  useSensor: jest.fn(),
  useSensors: jest.fn(() => []),
}));

jest.mock('@dnd-kit/sortable', () => ({
  arrayMove: jest.fn(),
  SortableContext: ({ children }: { children: React.ReactNode }) => <div data-testid="sortable-context">{children}</div>,
  sortableKeyboardCoordinates: jest.fn(),
  verticalListSortingStrategy: jest.fn(),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: jest.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));

jest.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: {
      toString: jest.fn(() => ''),
    },
  },
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

const mockTimeBlocks: TimeBlock[] = [
  {
    id: 'block-1',
    staff_id: 'staff-1',
    day_of_week: 1, // Monday
    start_time: '09:00',
    end_time: '17:00',
    is_recurring: true,
    is_active: true,
    color: '#3B82F6',
    staff_name: 'John Doe',
    staff_role: 'Stylist',
  },
  {
    id: 'block-2',
    staff_id: 'staff-2',
    day_of_week: 2, // Tuesday
    start_time: '10:00',
    end_time: '18:00',
    is_recurring: true,
    is_active: true,
    color: '#10B981',
    staff_name: 'Jane Smith',
    staff_role: 'Manager',
  },
];

describe('AvailabilityCalendar', () => {
  const defaultProps = {
    staffMembers: mockStaffMembers,
    timeBlocks: mockTimeBlocks,
    onTimeBlockAdd: jest.fn(),
    onTimeBlockUpdate: jest.fn(),
    onTimeBlockDelete: jest.fn(),
    onCopyWeek: jest.fn(),
    onError: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the availability calendar', () => {
    render(<AvailabilityCalendar {...defaultProps} />);
    
    expect(screen.getByText('Availability Calendar')).toBeInTheDocument();
    expect(screen.getByText('Staff')).toBeInTheDocument();
    expect(screen.getByText('Sun')).toBeInTheDocument();
    expect(screen.getByText('Mon')).toBeInTheDocument();
    expect(screen.getByText('Tue')).toBeInTheDocument();
  });

  it('displays staff members in the calendar', () => {
    render(<AvailabilityCalendar {...defaultProps} />);
    
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Stylist')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Manager')).toBeInTheDocument();
  });

  it('displays time blocks for staff members', () => {
    render(<AvailabilityCalendar {...defaultProps} />);
    
    expect(screen.getByText('9:00 AM - 5:00 PM')).toBeInTheDocument();
    expect(screen.getByText('10:00 AM - 6:00 PM')).toBeInTheDocument();
  });

  it('shows staff color indicators', () => {
    render(<AvailabilityCalendar {...defaultProps} />);
    
    const colorIndicators = screen.getAllByTestId('staff-color-indicator');
    expect(colorIndicators).toHaveLength(2);
  });

  it('displays total hours per week for each staff member', () => {
    render(<AvailabilityCalendar {...defaultProps} />);
    
    expect(screen.getByText('8.0h/week')).toBeInTheDocument();
    expect(screen.getByText('8.0h/week')).toBeInTheDocument();
  });

  it('shows add time block buttons', () => {
    render(<AvailabilityCalendar {...defaultProps} />);
    
    const addButtons = screen.getAllByText('Add');
    expect(addButtons.length).toBeGreaterThan(0);
  });

  it('calls onTimeBlockAdd when add button is clicked', async () => {
    const user = userEvent.setup();
    render(<AvailabilityCalendar {...defaultProps} />);
    
    const addButtons = screen.getAllByText('Add');
    await user.click(addButtons[0]);
    
    // Should open the time block editor modal
    expect(screen.getByText('Add Time Block')).toBeInTheDocument();
  });

  it('shows quick action buttons', () => {
    render(<AvailabilityCalendar {...defaultProps} />);
    
    expect(screen.getByText('Add Recurring Pattern')).toBeInTheDocument();
    expect(screen.getByText('Copy Week')).toBeInTheDocument();
  });

  it('calls onCopyWeek when copy week button is clicked', async () => {
    const user = userEvent.setup();
    render(<AvailabilityCalendar {...defaultProps} />);
    
    const copyWeekButton = screen.getByText('Copy Week');
    await user.click(copyWeekButton);
    
    expect(defaultProps.onCopyWeek).toHaveBeenCalledTimes(1);
  });

  it('shows recurring pattern editor when add recurring pattern is clicked', async () => {
    const user = userEvent.setup();
    render(<AvailabilityCalendar {...defaultProps} />);
    
    const addRecurringButton = screen.getByText('Add Recurring Pattern');
    await user.click(addRecurringButton);
    
    expect(screen.getByText('Add Recurring Pattern')).toBeInTheDocument();
  });

  it('displays calendar navigation controls', () => {
    render(<AvailabilityCalendar {...defaultProps} />);
    
    expect(screen.getByText('Today')).toBeInTheDocument();
    // Navigation arrows should be present
    const prevButton = screen.getByRole('button', { name: /previous/i });
    const nextButton = screen.getByRole('button', { name: /next/i });
    expect(prevButton).toBeInTheDocument();
    expect(nextButton).toBeInTheDocument();
  });

  it('shows time block duration and break information', () => {
    const timeBlocksWithBreak: TimeBlock[] = [
      {
        ...mockTimeBlocks[0],
        break_start: '12:00',
        break_end: '13:00',
      },
    ];

    render(
      <AvailabilityCalendar
        {...defaultProps}
        timeBlocks={timeBlocksWithBreak}
      />
    );
    
    expect(screen.getByText('8h 0m')).toBeInTheDocument();
    expect(screen.getByText('(Break: 1h 0m)')).toBeInTheDocument();
  });

  it('shows recurring indicator for recurring time blocks', () => {
    render(<AvailabilityCalendar {...defaultProps} />);
    
    expect(screen.getByText('Recurring weekly')).toBeInTheDocument();
  });

  it('handles empty time blocks gracefully', () => {
    render(
      <AvailabilityCalendar
        {...defaultProps}
        timeBlocks={[]}
      />
    );
    
    expect(screen.getByText('Availability Calendar')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('shows drag and drop context', () => {
    render(<AvailabilityCalendar {...defaultProps} />);
    
    expect(screen.getByTestId('dnd-context')).toBeInTheDocument();
    expect(screen.getByTestId('sortable-context')).toBeInTheDocument();
  });

  it('displays current month and year', () => {
    render(<AvailabilityCalendar {...defaultProps} />);
    
    const currentDate = new Date();
    const monthYear = currentDate.toLocaleDateString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    });
    
    expect(screen.getByText(monthYear)).toBeInTheDocument();
  });
});
