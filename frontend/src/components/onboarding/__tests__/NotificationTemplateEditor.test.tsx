/**
 * NotificationTemplateEditor Component Tests
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NotificationTemplateEditor } from '../NotificationTemplateEditor';
import type { NotificationTemplate } from '../../../api/types/notifications';

// Mock the hooks
jest.mock('../../../hooks/usePlaceholderValidation', () => ({
  usePlaceholderValidation: () => ({
    isValid: true,
    missingPlaceholders: [],
    invalidPlaceholders: [],
  }),
}));

describe('NotificationTemplateEditor', () => {
  const mockOnSave = jest.fn();
  const mockOnCancel = jest.fn();
  const mockOnPreview = jest.fn();

  const defaultProps = {
    onSave: mockOnSave,
    onCancel: mockOnCancel,
    onPreview: mockOnPreview,
  };

  const sampleTemplate: NotificationTemplate = {
    id: 'template-1',
    tenant_id: 'tenant-1',
    name: 'Booking Confirmation',
    channel: 'email',
    subject: 'Your booking is confirmed!',
    content: 'Hello {customer_name}, your booking for {service_name} is confirmed.',
    variables: {},
    required_variables: ['customer_name', 'service_name'],
    trigger_event: 'booking_created',
    category: 'confirmation',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<NotificationTemplateEditor {...defaultProps} />);
    expect(screen.getByText('Create Template')).toBeInTheDocument();
  });

  it('renders with existing template data', () => {
    render(<NotificationTemplateEditor {...defaultProps} template={sampleTemplate} />);
    expect(screen.getByText('Edit Template')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Booking Confirmation')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Your booking is confirmed!')).toBeInTheDocument();
  });

  it('shows email subject field only for email channel', () => {
    render(<NotificationTemplateEditor {...defaultProps} template={sampleTemplate} />);
    expect(screen.getByLabelText('Email Subject *')).toBeInTheDocument();
    
    // Change to SMS channel
    const channelSelect = screen.getByLabelText('Channel *');
    fireEvent.change(channelSelect, { target: { value: 'sms' } });
    
    expect(screen.queryByLabelText('Email Subject *')).not.toBeInTheDocument();
  });

  it('calls onSave when form is submitted', async () => {
    mockOnSave.mockResolvedValue(true);
    
    render(<NotificationTemplateEditor {...defaultProps} />);
    
    // Fill in required fields
    fireEvent.change(screen.getByLabelText('Template Name *'), {
      target: { value: 'Test Template' },
    });
    fireEvent.change(screen.getByLabelText('Template Content *'), {
      target: { value: 'Test content with {customer_name}' },
    });
    
    // Submit form
    fireEvent.click(screen.getByText('Save Template'));
    
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Template',
          content: 'Test content with {customer_name}',
        })
      );
    });
  });

  it('calls onCancel when cancel button is clicked', () => {
    render(<NotificationTemplateEditor {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Cancel'));
    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('shows preview mode when preview button is clicked', () => {
    render(<NotificationTemplateEditor {...defaultProps} />);
    
    // Fill in content to enable preview
    fireEvent.change(screen.getByLabelText('Template Content *'), {
      target: { value: 'Test content' },
    });
    
    fireEvent.click(screen.getByText('Preview'));
    expect(screen.getByText('Template Preview')).toBeInTheDocument();
  });

  it('shows loading state when submitting', () => {
    render(<NotificationTemplateEditor {...defaultProps} isSubmitting={true} />);
    expect(screen.getByText('Saving...')).toBeInTheDocument();
  });

  it('shows error messages', () => {
    const errors = { general: 'Something went wrong' };
    render(<NotificationTemplateEditor {...defaultProps} errors={errors} />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('disables save button when form is invalid', () => {
    render(<NotificationTemplateEditor {...defaultProps} />);
    const saveButton = screen.getByText('Save Template');
    expect(saveButton).toBeDisabled();
  });

  it('includes placeholder validator when enabled', () => {
    render(<NotificationTemplateEditor {...defaultProps} showPlaceholderValidator={true} />);
    expect(screen.getByText('Available Placeholders')).toBeInTheDocument();
  });
});
