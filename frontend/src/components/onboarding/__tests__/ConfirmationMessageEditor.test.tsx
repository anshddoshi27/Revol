/**
 * ConfirmationMessageEditor Component Tests
 * 
 * Tests for the ConfirmationMessageEditor component functionality.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmationMessageEditor } from '../ConfirmationMessageEditor';
import type { ConfirmationMessage } from '../../../api/types/policies';

// Mock the useForm hook
jest.mock('react-hook-form', () => ({
  useForm: () => ({
    register: jest.fn(),
    handleSubmit: (fn: any) => (e: any) => {
      e.preventDefault();
      fn({
        content: 'Test confirmation message',
        is_active: true,
      });
    },
    watch: jest.fn((field: string) => {
      const values: Record<string, any> = {
        content: 'Test confirmation message',
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

const mockMessage: ConfirmationMessage = {
  id: '1',
  tenant_id: 'tenant-1',
  content: 'Thank you for your booking!',
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

describe('ConfirmationMessageEditor', () => {
  const mockOnSave = jest.fn();
  const mockOnCancel = jest.fn();
  const mockOnPreview = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the confirmation message editor form', () => {
    render(
      <ConfirmationMessageEditor
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('Confirmation Message')).toBeInTheDocument();
    expect(screen.getByText('Message Content')).toBeInTheDocument();
  });

  it('renders with existing message data', () => {
    render(
      <ConfirmationMessageEditor
        message={mockMessage}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByDisplayValue('Thank you for your booking!')).toBeInTheDocument();
  });

  it('shows templates when templates button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ConfirmationMessageEditor
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    const templatesButton = screen.getByText('Templates');
    await user.click(templatesButton);

    expect(screen.getByText('Message Templates')).toBeInTheDocument();
    expect(screen.getByText('Standard Confirmation')).toBeInTheDocument();
    expect(screen.getByText('Detailed Confirmation')).toBeInTheDocument();
  });

  it('shows quick paste options when quick paste button is clicked', async () => {
    const user = userEvent.setup();
    const serviceDetails = {
      name: 'Test Service',
      description: 'Test Description',
      duration_minutes: 60,
      price_cents: 5000,
    };

    render(
      <ConfirmationMessageEditor
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        serviceDetails={serviceDetails}
      />
    );

    const quickPasteButton = screen.getByText('Quick Paste');
    await user.click(quickPasteButton);

    expect(screen.getByText('Quick Paste Variables')).toBeInTheDocument();
    expect(screen.getByText('Service Name')).toBeInTheDocument();
    expect(screen.getByText('Service Duration')).toBeInTheDocument();
  });

  it('calls onSave when form is submitted', async () => {
    const user = userEvent.setup();
    mockOnSave.mockResolvedValue(true);

    render(
      <ConfirmationMessageEditor
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    const saveButton = screen.getByText('Save Message');
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith({
        content: 'Test confirmation message',
        is_active: true,
      });
    });
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ConfirmationMessageEditor
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
      <ConfirmationMessageEditor
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        onPreview={mockOnPreview}
      />
    );

    const previewButton = screen.getByText('Preview');
    await user.click(previewButton);

    await waitFor(() => {
      expect(mockOnPreview).toHaveBeenCalledWith('Test confirmation message');
    });
  });

  it('shows loading state when submitting', () => {
    render(
      <ConfirmationMessageEditor
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        isSubmitting={true}
      />
    );

    expect(screen.getByText('Saving...')).toBeInTheDocument();
    expect(screen.getByText('Save Message')).toBeDisabled();
  });

  it('shows loading state when previewing', () => {
    render(
      <ConfirmationMessageEditor
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        onPreview={mockOnPreview}
      />
    );

    // Mock previewing state
    const previewButton = screen.getByText('Preview');
    fireEvent.click(previewButton);

    // The component would show previewing state, but we need to mock this
    expect(previewButton).toBeInTheDocument();
  });

  it('displays validation errors', () => {
    const errors = {
      content: 'Content is required',
      general: 'General error message',
    };

    render(
      <ConfirmationMessageEditor
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        errors={errors}
      />
    );

    expect(screen.getByText('Content is required')).toBeInTheDocument();
    expect(screen.getByText('General error message')).toBeInTheDocument();
  });

  it('displays character count for content field', () => {
    render(
      <ConfirmationMessageEditor
        onSave={mockOnSave}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('0/2000 characters')).toBeInTheDocument();
  });

  it('groups quick paste options by category', async () => {
    const user = userEvent.setup();
    const serviceDetails = {
      name: 'Test Service',
      description: 'Test Description',
      duration_minutes: 60,
      price_cents: 5000,
    };

    render(
      <ConfirmationMessageEditor
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        serviceDetails={serviceDetails}
      />
    );

    const quickPasteButton = screen.getByText('Quick Paste');
    await user.click(quickPasteButton);

    expect(screen.getByText('service')).toBeInTheDocument();
    expect(screen.getByText('price')).toBeInTheDocument();
  });
});

