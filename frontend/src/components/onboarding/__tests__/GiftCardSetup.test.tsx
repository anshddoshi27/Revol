/**
 * GiftCardSetup Component Tests
 * 
 * Unit tests for the GiftCardSetup component.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GiftCardSetup } from '../GiftCardSetup';
import type { GiftCardConfig } from '../../../api/types/giftCards';

// Mock the hooks
jest.mock('../../../hooks/useGiftCardSetup', () => ({
  useGiftCardSetup: jest.fn(),
}));

// Mock the services
jest.mock('../../../services/telemetry', () => ({
  telemetry: {
    track: jest.fn(),
  },
}));

const mockUseGiftCardSetup = require('../../../hooks/useGiftCardSetup').useGiftCardSetup;

describe('GiftCardSetup', () => {
  const mockOnSave = jest.fn();
  const mockOnSkip = jest.fn();

  const defaultMockReturn = {
    config: null,
    isEnabled: false,
    denominations: [],
    expirationPolicy: '1 year from purchase',
    isLoading: false,
    isSubmitting: false,
    errors: {},
    validationErrors: [],
    setEnabled: jest.fn(),
    setExpirationPolicy: jest.fn(),
    addDenomination: jest.fn(),
    updateDenomination: jest.fn(),
    removeDenomination: jest.fn(),
    saveConfig: jest.fn(),
    skipGiftCards: jest.fn(),
    clearErrors: jest.fn(),
    isValid: true,
    canProceed: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseGiftCardSetup.mockReturnValue(defaultMockReturn);
  });

  it('renders gift card setup form', () => {
    render(<GiftCardSetup onSave={mockOnSave} onSkip={mockOnSkip} />);

    expect(screen.getByText('Gift Cards')).toBeInTheDocument();
    expect(screen.getByText('Enable Gift Cards')).toBeInTheDocument();
    expect(screen.getByText('Skip Gift Cards')).toBeInTheDocument();
  });

  it('shows loading state when loading', () => {
    mockUseGiftCardSetup.mockReturnValue({
      ...defaultMockReturn,
      isLoading: true,
    });

    render(<GiftCardSetup onSave={mockOnSave} onSkip={mockOnSkip} />);

    expect(screen.getByText('Loading gift card setup...')).toBeInTheDocument();
  });

  it('toggles gift card enablement', () => {
    const mockSetEnabled = jest.fn();
    mockUseGiftCardSetup.mockReturnValue({
      ...defaultMockReturn,
      setEnabled: mockSetEnabled,
    });

    render(<GiftCardSetup onSave={mockOnSave} onSkip={mockOnSkip} />);

    const toggle = screen.getByRole('checkbox');
    fireEvent.click(toggle);

    expect(mockSetEnabled).toHaveBeenCalledWith(true);
  });

  it('shows gift card configuration when enabled', () => {
    mockUseGiftCardSetup.mockReturnValue({
      ...defaultMockReturn,
      isEnabled: true,
    });

    render(<GiftCardSetup onSave={mockOnSave} onSkip={mockOnSkip} />);

    expect(screen.getByText('Expiration Policy')).toBeInTheDocument();
    expect(screen.getByText('Gift Card Amounts')).toBeInTheDocument();
  });

  it('displays validation errors', () => {
    mockUseGiftCardSetup.mockReturnValue({
      ...defaultMockReturn,
      validationErrors: ['At least one denomination is required'],
    });

    render(<GiftCardSetup onSave={mockOnSave} onSkip={mockOnSkip} />);

    expect(screen.getByText('At least one denomination is required')).toBeInTheDocument();
  });

  it('calls onSave when save button is clicked', async () => {
    const mockSaveConfig = jest.fn().mockResolvedValue(true);
    mockUseGiftCardSetup.mockReturnValue({
      ...defaultMockReturn,
      isEnabled: true,
      saveConfig: mockSaveConfig,
    });

    render(<GiftCardSetup onSave={mockOnSave} onSkip={mockOnSkip} />);

    const saveButton = screen.getByText('Save Gift Cards');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockSaveConfig).toHaveBeenCalled();
    });
  });

  it('calls onSkip when skip button is clicked', async () => {
    const mockSkipGiftCards = jest.fn().mockResolvedValue(true);
    mockUseGiftCardSetup.mockReturnValue({
      ...defaultMockReturn,
      skipGiftCards: mockSkipGiftCards,
    });

    render(<GiftCardSetup onSave={mockOnSave} onSkip={mockOnSkip} />);

    const skipButton = screen.getByText('Skip Gift Cards');
    fireEvent.click(skipButton);

    await waitFor(() => {
      expect(mockSkipGiftCards).toHaveBeenCalled();
    });
  });

  it('disables buttons when submitting', () => {
    mockUseGiftCardSetup.mockReturnValue({
      ...defaultMockReturn,
      isSubmitting: true,
    });

    render(<GiftCardSetup onSave={mockOnSave} onSkip={mockOnSkip} />);

    const skipButton = screen.getByText('Skip Gift Cards');
    expect(skipButton).toBeDisabled();
  });

  it('shows preview button when gift cards are enabled', () => {
    mockUseGiftCardSetup.mockReturnValue({
      ...defaultMockReturn,
      isEnabled: true,
    });

    render(<GiftCardSetup onSave={mockOnSave} onSkip={mockOnSkip} />);

    expect(screen.getByText('Preview')).toBeInTheDocument();
  });
});


