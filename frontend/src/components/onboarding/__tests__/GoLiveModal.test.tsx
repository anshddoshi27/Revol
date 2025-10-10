/**
 * GoLiveModal Component Tests
 * 
 * Tests for the GoLiveModal component including consent validation and go-live confirmation.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GoLiveModal } from '../GoLiveModal';
import { telemetry } from '../../../services/telemetry';

// Mock services
jest.mock('../../../services/telemetry');

const mockTelemetry = telemetry as jest.Mocked<typeof telemetry>;

describe('GoLiveModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    onConfirm: jest.fn(),
    businessName: 'Test Business',
    tenantId: 'test-tenant',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders modal when open', () => {
    render(<GoLiveModal {...defaultProps} />);

    expect(screen.getByText('Ready to Go Live?')).toBeInTheDocument();
    expect(screen.getByText('Test Business')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<GoLiveModal {...defaultProps} isOpen={false} />);

    expect(screen.queryByText('Ready to Go Live?')).not.toBeInTheDocument();
  });

  it('shows important information', () => {
    render(<GoLiveModal {...defaultProps} />);

    expect(screen.getByText('Important Information')).toBeInTheDocument();
    expect(screen.getByText('Your booking site will be publicly accessible')).toBeInTheDocument();
    expect(screen.getByText('You\'ll start receiving real customer bookings')).toBeInTheDocument();
    expect(screen.getByText('Your subscription billing will begin')).toBeInTheDocument();
    expect(screen.getByText('You can make changes anytime in your admin dashboard')).toBeInTheDocument();
  });

  it('shows all consent checkboxes', () => {
    render(<GoLiveModal {...defaultProps} />);

    expect(screen.getByLabelText(/I agree to the Terms of Service/)).toBeInTheDocument();
    expect(screen.getByLabelText(/I agree to the Privacy Policy/)).toBeInTheDocument();
    expect(screen.getByLabelText(/I understand that I will be charged \$11\.99\/month/)).toBeInTheDocument();
    expect(screen.getByLabelText(/I confirm that I want to make my business live/)).toBeInTheDocument();
  });

  it('validates required consent checkboxes', async () => {
    render(<GoLiveModal {...defaultProps} />);

    const goLiveButton = screen.getByText('Go Live!');
    fireEvent.click(goLiveButton);

    await waitFor(() => {
      expect(screen.getByText('You must agree to the terms of service')).toBeInTheDocument();
      expect(screen.getByText('You must agree to the privacy policy')).toBeInTheDocument();
      expect(screen.getByText('You must agree to the subscription terms')).toBeInTheDocument();
      expect(screen.getByText('You must confirm that you want to go live')).toBeInTheDocument();
    });
  });

  it('calls onConfirm when all checkboxes are checked and form is submitted', async () => {
    render(<GoLiveModal {...defaultProps} />);

    // Check all consent boxes
    fireEvent.click(screen.getByLabelText(/I agree to the Terms of Service/));
    fireEvent.click(screen.getByLabelText(/I agree to the Privacy Policy/));
    fireEvent.click(screen.getByLabelText(/I understand that I will be charged \$11\.99\/month/));
    fireEvent.click(screen.getByLabelText(/I confirm that I want to make my business live/));

    const goLiveButton = screen.getByText('Go Live!');
    fireEvent.click(goLiveButton);

    await waitFor(() => {
      expect(defaultProps.onConfirm).toHaveBeenCalledWith({
        consent_terms: true,
        consent_privacy: true,
        consent_subscription: true,
        confirm_go_live: true,
      });
    });
  });

  it('calls onClose when cancel button is clicked', () => {
    render(<GoLiveModal {...defaultProps} />);

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls onClose when background overlay is clicked', () => {
    render(<GoLiveModal {...defaultProps} />);

    // Find the background overlay by its class
    const overlay = document.querySelector('.fixed.inset-0.bg-gray-500');
    fireEvent.click(overlay!);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('emits telemetry event when go live is confirmed', async () => {
    render(<GoLiveModal {...defaultProps} />);

    // Check all consent boxes
    fireEvent.click(screen.getByLabelText(/I agree to the Terms of Service/));
    fireEvent.click(screen.getByLabelText(/I agree to the Privacy Policy/));
    fireEvent.click(screen.getByLabelText(/I understand that I will be charged \$11\.99\/month/));
    fireEvent.click(screen.getByLabelText(/I confirm that I want to make my business live/));

    const goLiveButton = screen.getByText('Go Live!');
    fireEvent.click(goLiveButton);

    await waitFor(() => {
      expect(mockTelemetry.track).toHaveBeenCalledWith('owner.go_live_confirmed', {
        tenant_id: 'test-tenant',
        business_name: 'Test Business',
      });
    });
  });

  it('shows loading state when submitting', async () => {
    const slowOnConfirm = jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    
    render(<GoLiveModal {...defaultProps} onConfirm={slowOnConfirm} />);

    // Check all consent boxes
    fireEvent.click(screen.getByLabelText(/I agree to the Terms of Service/));
    fireEvent.click(screen.getByLabelText(/I agree to the Privacy Policy/));
    fireEvent.click(screen.getByLabelText(/I understand that I will be charged \$11\.99\/month/));
    fireEvent.click(screen.getByLabelText(/I confirm that I want to make my business live/));

    const goLiveButton = screen.getByText('Go Live!');
    fireEvent.click(goLiveButton);

    expect(screen.getByText('Going Live...')).toBeInTheDocument();
    expect(goLiveButton).toBeDisabled();
  });

  it('disables cancel button when submitting', async () => {
    const slowOnConfirm = jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    
    render(<GoLiveModal {...defaultProps} onConfirm={slowOnConfirm} />);

    // Check all consent boxes
    fireEvent.click(screen.getByLabelText(/I agree to the Terms of Service/));
    fireEvent.click(screen.getByLabelText(/I agree to the Privacy Policy/));
    fireEvent.click(screen.getByLabelText(/I understand that I will be charged \$11\.99\/month/));
    fireEvent.click(screen.getByLabelText(/I confirm that I want to make my business live/));

    const goLiveButton = screen.getByText('Go Live!');
    fireEvent.click(goLiveButton);

    const cancelButton = screen.getByText('Cancel');
    expect(cancelButton).toBeDisabled();
  });

  it('clears errors when user starts checking boxes', async () => {
    render(<GoLiveModal {...defaultProps} />);

    // Submit form to show errors
    const goLiveButton = screen.getByText('Go Live!');
    fireEvent.click(goLiveButton);

    await waitFor(() => {
      expect(screen.getByText('You must agree to the terms of service')).toBeInTheDocument();
    });

    // Check a box to clear its error
    fireEvent.click(screen.getByLabelText(/I agree to the Terms of Service/));

    await waitFor(() => {
      expect(screen.queryByText('You must agree to the terms of service')).not.toBeInTheDocument();
    });
  });

  it('shows links to terms and privacy policy', () => {
    render(<GoLiveModal {...defaultProps} />);

    const termsLink = screen.getByText('Terms of Service');
    const privacyLink = screen.getByText('Privacy Policy');

    expect(termsLink.closest('a')).toHaveAttribute('href', '/terms');
    expect(termsLink.closest('a')).toHaveAttribute('target', '_blank');
    expect(privacyLink.closest('a')).toHaveAttribute('href', '/privacy');
    expect(privacyLink.closest('a')).toHaveAttribute('target', '_blank');
  });
});
