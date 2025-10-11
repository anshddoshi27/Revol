/**
 * Step5Notifications Page Tests
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Step5Notifications } from '../Step5Notifications';

// Mock the hooks
jest.mock('../../../hooks/useNotificationTemplates', () => ({
  useNotificationTemplates: () => ({
    templates: [],
    isLoading: false,
    isSubmitting: false,
    errors: {},
    createTemplate: jest.fn(),
    updateTemplate: jest.fn(),
    deleteTemplate: jest.fn(),
    getQuietHours: jest.fn(),
    updateQuietHours: jest.fn(),
    checkTemplateLimit: jest.fn(),
    canAddConfirmation: true,
    canAddReminder: true,
    totalTemplates: 0,
  }),
}));

// Mock react-router-dom
const mockNavigate = jest.fn();
const mockLocation = {
  state: null,
  pathname: '/onboarding/notifications',
  search: '',
  hash: '',
  key: 'test',
};

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
}));

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('Step5Notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    renderWithRouter(<Step5Notifications />);
    expect(screen.getByText('Notification Templates')).toBeInTheDocument();
  });

  it('shows step progress indicator', () => {
    renderWithRouter(<Step5Notifications />);
    expect(screen.getByText('Step 5 of 8')).toBeInTheDocument();
  });

  it('shows overview cards', () => {
    renderWithRouter(<Step5Notifications />);
    expect(screen.getByText('Total Templates')).toBeInTheDocument();
    expect(screen.getByText('Confirmation Templates')).toBeInTheDocument();
    expect(screen.getByText('Reminder Templates')).toBeInTheDocument();
  });

  it('shows create template button', () => {
    renderWithRouter(<Step5Notifications />);
    expect(screen.getByText('Create Template')).toBeInTheDocument();
  });

  it('shows quiet hours button', () => {
    renderWithRouter(<Step5Notifications />);
    expect(screen.getByText('Quiet Hours')).toBeInTheDocument();
  });

  it('shows navigation buttons', () => {
    renderWithRouter(<Step5Notifications />);
    expect(screen.getByText('Back')).toBeInTheDocument();
    expect(screen.getByText('Continue')).toBeInTheDocument();
  });

  it('shows template limits info', () => {
    renderWithRouter(<Step5Notifications />);
    expect(screen.getByText('Template Limits')).toBeInTheDocument();
    expect(screen.getByText(/You can create up to 3 notification templates total/)).toBeInTheDocument();
  });

  it('disables continue button when no confirmation templates exist', () => {
    renderWithRouter(<Step5Notifications />);
    const continueButton = screen.getByText('Continue');
    expect(continueButton).toBeDisabled();
  });

  it('shows empty state when no templates exist', () => {
    renderWithRouter(<Step5Notifications />);
    expect(screen.getByText('No templates')).toBeInTheDocument();
    expect(screen.getByText('Get started by creating your first notification template.')).toBeInTheDocument();
  });
});
