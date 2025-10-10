/**
 * PaymentSetup Component Tests
 * 
 * Tests for the PaymentSetup component including Stripe Elements integration.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PaymentSetup } from '../PaymentSetup';
import { paymentService } from '../../../api/services/payments';
import { telemetry } from '../../../services/telemetry';

// Mock Stripe
jest.mock('@stripe/stripe-js', () => ({
  loadStripe: jest.fn(() => Promise.resolve({
    confirmCardSetup: jest.fn(),
  })),
}));

// Mock Stripe Elements
jest.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <div data-testid="stripe-elements">{children}</div>,
  CardElement: () => <div data-testid="card-element">Card Element</div>,
  useStripe: () => ({
    confirmCardSetup: jest.fn(),
  }),
  useElements: () => ({
    getElement: jest.fn(() => ({})),
  }),
}));

// Mock services
jest.mock('../../../api/services/payments');
jest.mock('../../../services/telemetry');

const mockPaymentService = paymentService as jest.Mocked<typeof paymentService>;
const mockTelemetry = telemetry as jest.Mocked<typeof telemetry>;

describe('PaymentSetup', () => {
  const defaultProps = {
    tenantId: 'test-tenant',
    onSetupComplete: jest.fn(),
    onError: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful setup intent creation
    mockPaymentService.createSetupIntent.mockResolvedValue({
      setup_intent: {
        id: 'seti_test123',
        client_secret: 'seti_test123_secret',
        status: 'requires_payment_method',
        created: Date.now(),
      },
      client_secret: 'seti_test123_secret',
    });
  });

  it('renders payment setup form', async () => {
    render(<PaymentSetup {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Subscription Plan')).toBeInTheDocument();
      expect(screen.getByText('Card Information')).toBeInTheDocument();
      expect(screen.getByText('I agree to the $11.99/month subscription')).toBeInTheDocument();
    });
  });

  it('shows loading state while creating setup intent', () => {
    render(<PaymentSetup {...defaultProps} />);

    expect(screen.getByText('Setting up payment system...')).toBeInTheDocument();
  });

  it('displays subscription information', async () => {
    render(<PaymentSetup {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('You\'ll be charged $11.99/month for your Tithi subscription.')).toBeInTheDocument();
      expect(screen.getByText('This includes all features: booking management, customer notifications, analytics, and more.')).toBeInTheDocument();
    });
  });

  it('validates required consent checkboxes', async () => {
    render(<PaymentSetup {...defaultProps} />);

    await waitFor(() => {
      const submitButton = screen.getByText('Setup Payment Method');
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(screen.getByText('You must agree to the subscription terms')).toBeInTheDocument();
      expect(screen.getByText('You must agree to the terms of service')).toBeInTheDocument();
      expect(screen.getByText('You must agree to the privacy policy')).toBeInTheDocument();
    });
  });

  it('calls onSetupComplete when payment setup succeeds', async () => {
    const mockStripe = {
      confirmCardSetup: jest.fn().mockResolvedValue({
        error: null,
        setupIntent: {
          id: 'seti_test123',
          status: 'succeeded',
          payment_method: 'pm_test123',
        },
      }),
    };

    // Mock useStripe hook
    jest.doMock('@stripe/react-stripe-js', () => ({
      ...jest.requireActual('@stripe/react-stripe-js'),
      useStripe: () => mockStripe,
    }));

    render(<PaymentSetup {...defaultProps} />);

    await waitFor(() => {
      // Check all consent boxes
      fireEvent.click(screen.getByLabelText(/I agree to the \$11\.99\/month subscription/));
      fireEvent.click(screen.getByLabelText(/I agree to the Terms of Service/));
      fireEvent.click(screen.getByLabelText(/I agree to the Privacy Policy/));
    });

    await waitFor(() => {
      const submitButton = screen.getByText('Setup Payment Method');
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(mockStripe.confirmCardSetup).toHaveBeenCalled();
    });
  });

  it('calls onError when setup intent creation fails', async () => {
    const errorMessage = 'Setup intent creation failed';
    mockPaymentService.createSetupIntent.mockRejectedValue(new Error(errorMessage));

    render(<PaymentSetup {...defaultProps} />);

    await waitFor(() => {
      expect(defaultProps.onError).toHaveBeenCalledWith(errorMessage);
    });
  });

  it('emits telemetry events', async () => {
    render(<PaymentSetup {...defaultProps} />);

    await waitFor(() => {
      expect(mockTelemetry.track).toHaveBeenCalledWith('payments.setup_intent_started', {
        tenant_id: 'test-tenant',
      });
    });
  });

  it('shows security information', async () => {
    render(<PaymentSetup {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Your card will be securely processed by Stripe. We don\'t store your card details.')).toBeInTheDocument();
    });
  });

  it('handles initial data correctly', async () => {
    const initialData = {
      subscription_consent: true,
      terms_consent: false,
      privacy_consent: false,
    };

    render(<PaymentSetup {...defaultProps} initialData={initialData} />);

    await waitFor(() => {
      const subscriptionCheckbox = screen.getByLabelText(/I agree to the \$11\.99\/month subscription/);
      expect(subscriptionCheckbox).toBeChecked();
    });
  });
});

