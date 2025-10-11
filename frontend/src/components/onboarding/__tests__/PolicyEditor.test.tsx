/**
 * PolicyEditor Component Tests
 * 
 * Tests for the PolicyEditor component functionality.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PolicyEditor } from '../PolicyEditor';
import type { BookingPolicy } from '../../../api/types/policies';

// Mock the useForm hook
jest.mock('react-hook-form', () => ({
  useForm: () => ({
    register: jest.fn(),
    handleSubmit: (fn: any) => (e: any) => {
      e.preventDefault();
      fn({
        cancellation_cutoff_hours: 24,
        no_show_fee_percent: 50,
        no_show_fee_flat_cents: 1000,
        refund_policy: 'Test refund policy',
        cash_logistics: 'Test cash logistics',
        is_active: true,
      });
    },
    watch: jest.fn((field: string) => {
      const values: Record<string, any> = {
        refund_policy: 'Test refund policy',
        cash_logistics: 'Test cash logistics',
      };
      return values[field] || '';
    }),
    setValue: jest.fn(),
    formState: {
      errors: {},
      isValid: true,
    },
  }),
}));

const mockPolicy: BookingPolicy = {
  id: '1',
  tenant_id: 'tenant-1',
  cancellation_cutoff_hours: 24,
  no_show_fee_percent: 50,
  no_show_fee_flat_cents: 1000,
  refund_policy: 'Test refund policy',
  cash_logistics: 'Test cash logistics',
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

describe('PolicyEditor', () => {
  const mockOnSave = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the policy editor form', () => {
    render(
      <PolicyEditor
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('Booking Policies')).toBeInTheDocument();
    expect(screen.getByText('Cancellation Policy')).toBeInTheDocument();
    expect(screen.getByText('No-Show Policy')).toBeInTheDocument();
    expect(screen.getByText('Refund Policy')).toBeInTheDocument();
    expect(screen.getByText('Cash Payment Policy')).toBeInTheDocument();
  });

  it('renders with existing policy data', () => {
    render(
      <PolicyEditor
        policy={mockPolicy}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByDisplayValue('24')).toBeInTheDocument();
    expect(screen.getByDisplayValue('50')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1000')).toBeInTheDocument();
  });

  it('shows templates when templates button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <PolicyEditor
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    const templatesButton = screen.getByText('Templates');
    await user.click(templatesButton);

    expect(screen.getByText('Policy Templates')).toBeInTheDocument();
    expect(screen.getByText('24-Hour Cancellation')).toBeInTheDocument();
    expect(screen.getByText('50% No-Show Fee')).toBeInTheDocument();
  });

  it('calls onSave when form is submitted', async () => {
    const user = userEvent.setup();
    mockOnSave.mockResolvedValue(true);

    render(
      <PolicyEditor
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    const saveButton = screen.getByText('Save Policies');
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith({
        cancellation_cutoff_hours: 24,
        no_show_fee_percent: 50,
        no_show_fee_flat_cents: 1000,
        refund_policy: 'Test refund policy',
        cash_logistics: 'Test cash logistics',
        is_active: true,
      });
    });
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <PolicyEditor
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    const cancelButton = screen.getByText('Cancel');
    await user.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('shows loading state when submitting', () => {
    render(
      <PolicyEditor
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        isSubmitting={true}
      />
    );

    expect(screen.getByText('Saving...')).toBeInTheDocument();
    expect(screen.getByText('Save Policies')).toBeDisabled();
  });

  it('displays validation errors', () => {
    const errors = {
      cancellation_cutoff_hours: 'Cancellation cutoff is required',
      general: 'General error message',
    };

    render(
      <PolicyEditor
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        errors={errors}
      />
    );

    expect(screen.getByText('Cancellation cutoff is required')).toBeInTheDocument();
    expect(screen.getByText('General error message')).toBeInTheDocument();
  });

  it('displays character count for text fields', () => {
    render(
      <PolicyEditor
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('0/1000 characters')).toBeInTheDocument();
    expect(screen.getByText('0/500 characters')).toBeInTheDocument();
  });
});


