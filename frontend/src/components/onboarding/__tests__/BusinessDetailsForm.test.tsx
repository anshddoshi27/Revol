/**
 * BusinessDetailsForm Tests
 * 
 * Unit tests for the BusinessDetailsForm component.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BusinessDetailsForm } from '../BusinessDetailsForm';

// Mock the hooks
jest.mock('../../../hooks/useBusinessDetailsForm');
jest.mock('../../../hooks/useSubdomainValidation');

const mockUseBusinessDetailsForm = require('../../../hooks/useBusinessDetailsForm').useBusinessDetailsForm;
const mockUseSubdomainValidation = require('../../../hooks/useSubdomainValidation').useSubdomainValidation;

describe('BusinessDetailsForm', () => {
  const mockFormData = {
    name: '',
    description: '',
    timezone: 'America/New_York',
    slug: '',
    dba: '',
    industry: '',
    address: {
      street: '',
      city: '',
      state_province: '',
      postal_code: '',
      country: 'US',
    },
    website: '',
    phone: '',
    support_email: '',
    staff: [],
    social_links: {
      instagram: '',
      facebook: '',
      tiktok: '',
      youtube: '',
      x: '',
      website: '',
    },
  };

  const mockFormActions = {
    updateField: jest.fn(),
    addStaff: jest.fn(),
    removeStaff: jest.fn(),
    updateStaff: jest.fn(),
    updateAddress: jest.fn(),
    updateSocialLinks: jest.fn(),
    submitForm: jest.fn(),
    isSubmitting: false,
    errors: {},
    clearErrors: jest.fn(),
  };

  const mockSubdomainValidation = {
    subdomain: '',
    setSubdomain: jest.fn(),
    isValid: false,
    isChecking: false,
    isAvailable: null,
    error: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUseBusinessDetailsForm.mockReturnValue({
      formData: mockFormData,
      ...mockFormActions,
    });
    
    mockUseSubdomainValidation.mockReturnValue(mockSubdomainValidation);
  });

  it('renders the form with all required fields', () => {
    render(<BusinessDetailsForm />);

    expect(screen.getByLabelText(/business name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/subdomain/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/timezone/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save & continue/i })).toBeInTheDocument();
  });

  it('displays required field indicators', () => {
    render(<BusinessDetailsForm />);

    const requiredFields = screen.getAllByText('*');
    expect(requiredFields.length).toBeGreaterThan(0);
  });

  it('calls updateField when business name is changed', () => {
    render(<BusinessDetailsForm />);

    const businessNameInput = screen.getByLabelText(/business name/i);
    fireEvent.change(businessNameInput, { target: { value: 'Test Business' } });

    expect(mockFormActions.updateField).toHaveBeenCalledWith('name', 'Test Business');
  });

  it('calls setSubdomain when subdomain is changed', () => {
    render(<BusinessDetailsForm />);

    const subdomainInput = screen.getByLabelText(/subdomain/i);
    fireEvent.change(subdomainInput, { target: { value: 'test-business' } });

    expect(mockSubdomainValidation.setSubdomain).toHaveBeenCalledWith('test-business');
  });

  it('displays subdomain availability status', () => {
    mockUseSubdomainValidation.mockReturnValue({
      ...mockSubdomainValidation,
      isAvailable: true,
    });

    render(<BusinessDetailsForm />);

    expect(screen.getByText(/✓ Available!/i)).toBeInTheDocument();
  });

  it('displays subdomain error when invalid', () => {
    mockUseSubdomainValidation.mockReturnValue({
      ...mockSubdomainValidation,
      error: 'Invalid subdomain format',
    });

    render(<BusinessDetailsForm />);

    expect(screen.getByText('Invalid subdomain format')).toBeInTheDocument();
  });

  it('displays form errors', () => {
    mockUseBusinessDetailsForm.mockReturnValue({
      formData: mockFormData,
      ...mockFormActions,
      errors: {
        name: 'Business name is required',
        support_email: 'Invalid email format',
      },
    });

    render(<BusinessDetailsForm />);

    expect(screen.getByText('Business name is required')).toBeInTheDocument();
    expect(screen.getByText('Invalid email format')).toBeInTheDocument();
  });

  it('disables submit button when form is invalid', () => {
    render(<BusinessDetailsForm />);

    const submitButton = screen.getByRole('button', { name: /save & continue/i });
    expect(submitButton).toBeDisabled();
  });

  it('enables submit button when form is valid', () => {
    mockUseBusinessDetailsForm.mockReturnValue({
      formData: { ...mockFormData, name: 'Test Business', slug: 'test-business' },
      ...mockFormActions,
    });

    mockUseSubdomainValidation.mockReturnValue({
      ...mockSubdomainValidation,
      isValid: true,
      isAvailable: true,
    });

    render(<BusinessDetailsForm />);

    const submitButton = screen.getByRole('button', { name: /save & continue/i });
    expect(submitButton).not.toBeDisabled();
  });

  it('calls submitForm when form is submitted', async () => {
    mockUseBusinessDetailsForm.mockReturnValue({
      formData: { ...mockFormData, name: 'Test Business', slug: 'test-business' },
      ...mockFormActions,
    });

    mockUseSubdomainValidation.mockReturnValue({
      ...mockSubdomainValidation,
      isValid: true,
      isAvailable: true,
    });

    render(<BusinessDetailsForm />);

    const form = screen.getByRole('form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockFormActions.submitForm).toHaveBeenCalled();
    });
  });

  it('shows loading state when submitting', () => {
    mockUseBusinessDetailsForm.mockReturnValue({
      formData: mockFormData,
      ...mockFormActions,
      isSubmitting: true,
    });

    render(<BusinessDetailsForm />);

    expect(screen.getByText('Saving...')).toBeInTheDocument();
  });

  it('renders back button when onBack is provided', () => {
    const mockOnBack = jest.fn();
    render(<BusinessDetailsForm onBack={mockOnBack} />);

    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
  });

  it('calls onBack when back button is clicked', () => {
    const mockOnBack = jest.fn();
    render(<BusinessDetailsForm onBack={mockOnBack} />);

    const backButton = screen.getByRole('button', { name: /back/i });
    fireEvent.click(backButton);

    expect(mockOnBack).toHaveBeenCalled();
  });
});
