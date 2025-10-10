/**
 * CheckoutWarningConfig Component Tests
 * 
 * Tests for the CheckoutWarningConfig component functionality.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CheckoutWarningConfig } from '../CheckoutWarningConfig';
import type { CheckoutWarning } from '../../../api/types/policies';

// Mock the useForm hook
jest.mock('react-hook-form', () => ({
  useForm: () => ({
    register: jest.fn(),
    handleSubmit: (fn: any) => (e: any) => {
      e.preventDefault();
      fn({
        title: 'Test Warning',
        message: 'Test warning message',
        acknowledgment_required: true,
        acknowledgment_text: 'I understand',
        is_active: true,
      });
    },
    watch: jest.fn((field: string) => {
      const values: Record<string, any> = {
        title: 'Test Warning',
        message: 'Test warning message',
        acknowledgment_text: 'I understand',
        acknowledgment_required: true,
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

const mockWarning: CheckoutWarning = {
  id: '1',
  tenant_id: 'tenant-1',
  title: 'Payment Information',
  message: 'You will be charged after your appointment.',
  acknowledgment_required: true,
  acknowledgment_text: 'I understand the payment policy.',
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

describe('CheckoutWarningConfig', () => {
  const mockOnSave = jest.fn();
  const mockOnCancel = jest.fn();
  const mockOnPreview = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the checkout warning config form', () => {
    render(
      <CheckoutWarningConfig
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('Checkout Warning')).toBeInTheDocument();
    expect(screen.getByText('Warning Title')).toBeInTheDocument();
    expect(screen.getByText('Warning Message')).toBeInTheDocument();
    expect(screen.getByText('Acknowledgment Configuration')).toBeInTheDocument();
  });

  it('renders with existing warning data', () => {
    render(
      <CheckoutWarningConfig
        warning={mockWarning}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByDisplayValue('Payment Information')).toBeInTheDocument();
    expect(screen.getByDisplayValue('You will be charged after your appointment.')).toBeInTheDocument();
  });

  it('shows templates when templates button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <CheckoutWarningConfig
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    const templatesButton = screen.getByText('Templates');
    await user.click(templatesButton);

    expect(screen.getByText('Warning Templates')).toBeInTheDocument();
    expect(screen.getByText('Attendance-Based Charging')).toBeInTheDocument();
    expect(screen.getByText('Cancellation Policy')).toBeInTheDocument();
  });

  it('calls onSave when form is submitted', async () => {
    const user = userEvent.setup();
    mockOnSave.mockResolvedValue(true);

    render(
      <CheckoutWarningConfig
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    const saveButton = screen.getByText('Save Warning');
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith({
        title: 'Test Warning',
        message: 'Test warning message',
        acknowledgment_required: true,
        acknowledgment_text: 'I understand',
        is_active: true,
      });
    });
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <CheckoutWarningConfig
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    const cancelButton = screen.getByText('Cancel');
    await user.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('calls onPreview when preview button is clicked', async () => {
    const user = userEvent.setup();
    mockOnPreview.mockResolvedValue('Preview content');

    render(
      <CheckoutWarningConfig
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        onPreview={mockOnPreview}
      />
    );

    const previewButton = screen.getByText('Preview');
    await user.click(previewButton);

    await waitFor(() => {
      expect(mockOnPreview).toHaveBeenCalledWith({
        title: 'Test Warning',
        message: 'Test warning message',
        acknowledgment_required: true,
        acknowledgment_text: 'I understand',
        is_active: true,
      });
    });
  });

  it('shows loading state when submitting', () => {
    render(
      <CheckoutWarningConfig
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        isSubmitting={true}
      />
    );

    expect(screen.getByText('Saving...')).toBeInTheDocument();
    expect(screen.getByText('Save Warning')).toBeDisabled();
  });

  it('displays validation errors', () => {
    const errors = {
      title: 'Title is required',
      message: 'Message is required',
      general: 'General error message',
    };

    render(
      <CheckoutWarningConfig
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        errors={errors}
      />
    );

    expect(screen.getByText('Title is required')).toBeInTheDocument();
    expect(screen.getByText('Message is required')).toBeInTheDocument();
    expect(screen.getByText('General error message')).toBeInTheDocument();
  });

  it('displays character count for text fields', () => {
    render(
      <CheckoutWarningConfig
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('0/100 characters')).toBeInTheDocument();
    expect(screen.getByText('0/500 characters')).toBeInTheDocument();
    expect(screen.getByText('0/200 characters')).toBeInTheDocument();
  });

  it('shows acknowledgment text field when acknowledgment is required', () => {
    render(
      <CheckoutWarningConfig
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    const acknowledgmentCheckbox = screen.getByLabelText('Require customer acknowledgment');
    expect(acknowledgmentCheckbox).toBeInTheDocument();
  });

  it('disables preview button when required fields are empty', () => {
    // Mock empty values
    jest.doMock('react-hook-form', () => ({
      useForm: () => ({
        register: jest.fn(),
        handleSubmit: jest.fn(),
        watch: jest.fn((field: string) => {
          const values: Record<string, any> = {
            title: '',
            message: '',
            acknowledgment_text: '',
            acknowledgment_required: true,
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

    render(
      <CheckoutWarningConfig
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        onPreview={mockOnPreview}
      />
    );

    const previewButton = screen.getByText('Preview');
    expect(previewButton).toBeDisabled();
  });
});

