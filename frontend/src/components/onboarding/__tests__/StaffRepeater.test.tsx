/**
 * StaffRepeater Tests
 * 
 * Unit tests for the StaffRepeater component.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { StaffRepeater } from '../StaffRepeater';

describe('StaffRepeater', () => {
  const mockStaff = [
    { id: '1', role: 'Stylist', name: 'John Doe', color: '#3B82F6' },
    { id: '2', role: 'Manager', name: 'Jane Smith', color: '#10B981' },
  ];

  const mockActions = {
    onAdd: jest.fn(),
    onRemove: jest.fn(),
    onUpdate: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders staff members with their information', () => {
    render(<StaffRepeater staff={mockStaff} {...mockActions} />);

    expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Stylist')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Jane Smith')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Manager')).toBeInTheDocument();
  });

  it('displays color indicators for staff members', () => {
    render(<StaffRepeater staff={mockStaff} {...mockActions} />);

    const colorIndicators = screen.getAllByTitle(/Color:/);
    expect(colorIndicators).toHaveLength(2);
  });

  it('calls onUpdate when staff role is changed', () => {
    render(<StaffRepeater staff={mockStaff} {...mockActions} />);

    const roleInput = screen.getAllByDisplayValue('Stylist')[0];
    fireEvent.change(roleInput, { target: { value: 'Senior Stylist' } });

    expect(mockActions.onUpdate).toHaveBeenCalledWith(0, { role: 'Senior Stylist' });
  });

  it('calls onUpdate when staff name is changed', () => {
    render(<StaffRepeater staff={mockStaff} {...mockActions} />);

    const nameInput = screen.getAllByDisplayValue('John Doe')[0];
    fireEvent.change(nameInput, { target: { value: 'John Smith' } });

    expect(mockActions.onUpdate).toHaveBeenCalledWith(0, { name: 'John Smith' });
  });

  it('calls onRemove when remove button is clicked', () => {
    render(<StaffRepeater staff={mockStaff} {...mockActions} />);

    const removeButtons = screen.getAllByLabelText(/Remove/);
    fireEvent.click(removeButtons[0]);

    expect(mockActions.onRemove).toHaveBeenCalledWith(0);
  });

  it('renders add staff form', () => {
    render(<StaffRepeater staff={mockStaff} {...mockActions} />);

    expect(screen.getAllByText('Add Team Member')).toHaveLength(2); // Header and button
    expect(screen.getByLabelText('Role')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
  });

  it('calls onAdd when add button is clicked with valid data', () => {
    render(<StaffRepeater staff={mockStaff} {...mockActions} />);

    const roleSelect = screen.getByLabelText('Role');
    const nameInput = screen.getByLabelText('Name');
    const addButton = screen.getByRole('button', { name: /add team member/i });

    fireEvent.change(roleSelect, { target: { value: 'Assistant' } });
    fireEvent.change(nameInput, { target: { value: 'Bob Wilson' } });
    fireEvent.click(addButton);

    expect(mockActions.onAdd).toHaveBeenCalledWith({
      role: 'Assistant',
      name: 'Bob Wilson',
    });
  });

  it('disables add button when form is incomplete', () => {
    render(<StaffRepeater staff={mockStaff} {...mockActions} />);

    const addButton = screen.getByRole('button', { name: /add team member/i });
    expect(addButton).toBeDisabled();
  });

  it('adds staff member when Enter key is pressed', () => {
    render(<StaffRepeater staff={[]} {...mockActions} />);

    const roleSelect = screen.getByLabelText('Role');
    const nameInput = screen.getByLabelText('Name');

    fireEvent.change(roleSelect, { target: { value: 'Assistant' } });
    fireEvent.change(nameInput, { target: { value: 'Bob Wilson' } });
    fireEvent.keyDown(nameInput, { key: 'Enter', code: 'Enter' });

    expect(mockActions.onAdd).toHaveBeenCalledWith({
      role: 'Assistant',
      name: 'Bob Wilson',
    });
  });

  it('displays error messages for staff members', () => {
    const errors = {
      'staff.0.name': 'Staff name is required',
      'staff.1.role': 'Staff role is required',
    };

    render(<StaffRepeater staff={mockStaff} {...mockActions} errors={errors} />);

    expect(screen.getByText('Staff name is required')).toBeInTheDocument();
    expect(screen.getByText('Staff role is required')).toBeInTheDocument();
  });

  it('shows empty state when no staff members', () => {
    render(<StaffRepeater staff={[]} {...mockActions} />);

    expect(screen.getByText('No team members yet')).toBeInTheDocument();
    expect(screen.getByText('Get started by adding your first team member above.')).toBeInTheDocument();
  });

  it('includes common roles in the role select', () => {
    render(<StaffRepeater staff={[]} {...mockActions} />);

    const roleSelect = screen.getByLabelText('Role');
    expect(roleSelect).toBeInTheDocument();

    // Check for some common roles
    expect(screen.getByText('Owner')).toBeInTheDocument();
    expect(screen.getByText('Stylist')).toBeInTheDocument();
    expect(screen.getByText('Manager')).toBeInTheDocument();
  });
});
