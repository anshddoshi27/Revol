/**
 * WalletToggles Component Tests
 * 
 * Tests for the WalletToggles component including wallet configuration validation.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WalletToggles } from '../WalletToggles';
import { telemetry } from '../../../services/telemetry';

// Mock services
jest.mock('../../../services/telemetry');

const mockTelemetry = telemetry as jest.Mocked<typeof telemetry>;

describe('WalletToggles', () => {
  const defaultProps = {
    tenantId: 'test-tenant',
    onConfigChange: jest.fn(),
    onError: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders wallet configuration form', () => {
    render(<WalletToggles {...defaultProps} />);

    expect(screen.getByText('Payment Methods')).toBeInTheDocument();
    expect(screen.getByText('Choose which payment methods your customers can use to book appointments.')).toBeInTheDocument();
  });

  it('shows all wallet options', () => {
    render(<WalletToggles {...defaultProps} />);

    expect(screen.getByText('Credit/Debit Cards')).toBeInTheDocument();
    expect(screen.getByText('Apple Pay')).toBeInTheDocument();
    expect(screen.getByText('Google Pay')).toBeInTheDocument();
    expect(screen.getByText('PayPal')).toBeInTheDocument();
    expect(screen.getByText('Cash Payments')).toBeInTheDocument();
  });

  it('has cards enabled by default', () => {
    render(<WalletToggles {...defaultProps} />);

    const cardsCheckbox = screen.getByLabelText(/Credit\/Debit Cards/);
    expect(cardsCheckbox).toBeChecked();
  });

  it('disables cash when cards are disabled', () => {
    render(<WalletToggles {...defaultProps} />);

    const cardsCheckbox = screen.getByLabelText(/Credit\/Debit Cards/);
    const cashCheckbox = screen.getByLabelText(/Cash Payments/);

    // Cards should be disabled (always enabled)
    expect(cardsCheckbox).toBeDisabled();
    
    // Cash should be enabled initially
    expect(cashCheckbox).not.toBeDisabled();
  });

  it('shows cash payment warning when cash is enabled', () => {
    render(<WalletToggles {...defaultProps} />);

    const cashCheckbox = screen.getByLabelText(/Cash Payments/);
    fireEvent.click(cashCheckbox);

    expect(screen.getByText('Cash Payment Policy')).toBeInTheDocument();
    expect(screen.getByText(/When cash payments are enabled, customers must provide a card on file/)).toBeInTheDocument();
  });

  it('calls onConfigChange when wallet configuration changes', () => {
    render(<WalletToggles {...defaultProps} />);

    const applePayCheckbox = screen.getByLabelText(/Apple Pay/);
    fireEvent.click(applePayCheckbox);

    expect(defaultProps.onConfigChange).toHaveBeenLastCalledWith({
      cards: true,
      apple_pay: true,
      google_pay: false,
      paypal: false,
      cash: false,
      cash_requires_card: false,
    });
  });

  it('emits telemetry events when toggles change', () => {
    render(<WalletToggles {...defaultProps} />);

    const googlePayCheckbox = screen.getByLabelText(/Google Pay/);
    fireEvent.click(googlePayCheckbox);

    expect(mockTelemetry.track).toHaveBeenCalledWith('wallets.toggle_update', {
      tenant_id: 'test-tenant',
      wallet_type: 'google_pay',
      enabled: true,
    });
  });

  it('shows payment method summary', () => {
    render(<WalletToggles {...defaultProps} />);

    expect(screen.getByText('Payment Method Summary')).toBeInTheDocument();
    expect(screen.getByText(/Customers will be able to pay using: Credit\/Debit Cards/)).toBeInTheDocument();
  });

  it('updates summary when multiple wallets are selected', () => {
    render(<WalletToggles {...defaultProps} />);

    const applePayCheckbox = screen.getByLabelText(/Apple Pay/);
    const paypalCheckbox = screen.getByLabelText(/PayPal/);

    fireEvent.click(applePayCheckbox);
    fireEvent.click(paypalCheckbox);

    expect(screen.getByText(/Customers will be able to pay using: Credit\/Debit Cards, Apple Pay, PayPal/)).toBeInTheDocument();
  });

  it('shows cash warning in summary when cash is enabled', () => {
    render(<WalletToggles {...defaultProps} />);

    const cashCheckbox = screen.getByLabelText(/Cash Payments/);
    fireEvent.click(cashCheckbox);

    expect(screen.getByText(/Cash payments require a card on file for no-show protection/)).toBeInTheDocument();
  });

  it('handles initial configuration correctly', () => {
    const initialConfig = {
      cards: true,
      apple_pay: true,
      google_pay: false,
      paypal: true,
      cash: false,
    };

    render(<WalletToggles {...defaultProps} initialConfig={initialConfig} />);

    expect(screen.getByLabelText(/Apple Pay/)).toBeChecked();
    expect(screen.getByLabelText(/Google Pay/)).not.toBeChecked();
    expect(screen.getByLabelText(/PayPal/)).toBeChecked();
    expect(screen.getByLabelText(/Cash Payments/)).not.toBeChecked();
  });

  it('disables all toggles when disabled prop is true', () => {
    render(<WalletToggles {...defaultProps} disabled={true} />);

    const applePayCheckbox = screen.getByLabelText(/Apple Pay/);
    const googlePayCheckbox = screen.getByLabelText(/Google Pay/);
    const paypalCheckbox = screen.getByLabelText(/PayPal/);
    const cashCheckbox = screen.getByLabelText(/Cash Payments/);

    expect(applePayCheckbox).toBeDisabled();
    expect(googlePayCheckbox).toBeDisabled();
    expect(paypalCheckbox).toBeDisabled();
    expect(cashCheckbox).toBeDisabled();
  });

  it('shows wallet descriptions', () => {
    render(<WalletToggles {...defaultProps} />);

    expect(screen.getByText('Accept Visa, Mastercard, American Express, and Discover')).toBeInTheDocument();
    expect(screen.getByText('Accept payments through Apple Pay on iOS devices')).toBeInTheDocument();
    expect(screen.getByText('Accept payments through Google Pay on Android devices')).toBeInTheDocument();
    expect(screen.getByText('Accept payments through PayPal accounts')).toBeInTheDocument();
    expect(screen.getByText('Accept cash payments (requires card on file for no-shows)')).toBeInTheDocument();
  });
});
