/**
 * PlaceholderValidator Component Tests
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlaceholderValidator } from '../PlaceholderValidator';

describe('PlaceholderValidator', () => {
  const mockOnContentChange = jest.fn();
  const mockOnRequiredVariablesChange = jest.fn();

  const defaultProps = {
    content: 'Hello {customer_name}, your booking for {service_name} is confirmed.',
    requiredVariables: ['customer_name', 'service_name'],
    onContentChange: mockOnContentChange,
    onRequiredVariablesChange: mockOnRequiredVariablesChange,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<PlaceholderValidator {...defaultProps} />);
    expect(screen.getByText('Available Placeholders')).toBeInTheDocument();
  });

  it('shows validation status when placeholders are valid', () => {
    render(<PlaceholderValidator {...defaultProps} />);
    expect(screen.getByText('All placeholders are valid')).toBeInTheDocument();
  });

  it('shows missing placeholders when required variables are not in content', () => {
    const props = {
      ...defaultProps,
      content: 'Hello {customer_name}, your booking is confirmed.',
      requiredVariables: ['customer_name', 'service_name', 'booking_time'],
    };
    
    render(<PlaceholderValidator {...props} />);
    expect(screen.getByText('Missing Required Placeholders')).toBeInTheDocument();
    expect(screen.getByText('{service_name}')).toBeInTheDocument();
    expect(screen.getByText('{booking_time}')).toBeInTheDocument();
  });

  it('allows inserting placeholders', () => {
    render(<PlaceholderValidator {...defaultProps} />);
    
    // Click to expand available placeholders
    const expandButton = screen.getByText('Available Placeholders');
    fireEvent.click(expandButton);
    
    // Find and click a placeholder button
    const placeholderButton = screen.getByText('Business Name');
    fireEvent.click(placeholderButton);
    
    expect(mockOnContentChange).toHaveBeenCalledWith(
      'Hello {customer_name}, your booking for {service_name} is confirmed.{business_name}'
    );
  });

  it('allows toggling required variables', () => {
    render(<PlaceholderValidator {...defaultProps} />);
    
    // Find a checkbox for a required variable
    const checkbox = screen.getByLabelText(/Customer Name/);
    fireEvent.click(checkbox);
    
    expect(mockOnRequiredVariablesChange).toHaveBeenCalledWith(['service_name']);
  });

  it('shows extracted placeholders summary', () => {
    render(<PlaceholderValidator {...defaultProps} />);
    expect(screen.getByText('Placeholders in Template')).toBeInTheDocument();
    expect(screen.getByText('{customer_name}')).toBeInTheDocument();
    expect(screen.getByText('{service_name}')).toBeInTheDocument();
  });

  it('can be configured to hide sections', () => {
    render(
      <PlaceholderValidator
        {...defaultProps}
        showAvailablePlaceholders={false}
        showRequiredVariables={false}
        showValidationErrors={false}
      />
    );
    
    expect(screen.queryByText('Available Placeholders')).not.toBeInTheDocument();
    expect(screen.queryByText('Required Variables')).not.toBeInTheDocument();
    expect(screen.queryByText('All placeholders are valid')).not.toBeInTheDocument();
  });
});
