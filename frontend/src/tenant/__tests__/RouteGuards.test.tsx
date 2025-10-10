/**
 * Route Guards Tests
 * 
 * Tests for route protection and authentication guards.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { 
  AuthGuard, 
  TenantGuard, 
  ProtectedRoute, 
  PublicRoute 
} from '../RouteGuards';

// Mock telemetry
jest.mock('@/observability', () => ({
  telemetry: {
    track: jest.fn(),
  },
}));

// Mock environment
jest.mock('@/lib/env', () => ({
  getToken: jest.fn(),
}));

import { getToken } from '@/lib/env';

// Mock window.location
const mockLocation = (pathname: string) => {
  Object.defineProperty(window, 'location', {
    value: {
      pathname,
    },
    writable: true,
  });
};

const TestContent: React.FC = () => <div>Protected Content</div>;
const FallbackContent: React.FC = () => <div>Access Denied</div>;

describe('Route Guards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocation('/admin/dashboard');
  });

  describe('AuthGuard', () => {
    it('should render children when user is authenticated', async () => {
      (getToken as jest.Mock).mockReturnValue('valid-token');
      
      render(
        <AuthGuard requireAuth={true}>
          <TestContent />
        </AuthGuard>
      );

      expect(await screen.findByText('Protected Content')).toBeInTheDocument();
    });

    it('should render fallback when user is not authenticated', async () => {
      (getToken as jest.Mock).mockReturnValue(null);
      
      render(
        <AuthGuard requireAuth={true} fallback={<FallbackContent />}>
          <TestContent />
        </AuthGuard>
      );

      expect(await screen.findByText('Access Denied')).toBeInTheDocument();
    });

    it('should render children when authentication is not required', async () => {
      (getToken as jest.Mock).mockReturnValue(null);
      
      render(
        <AuthGuard requireAuth={false}>
          <TestContent />
        </AuthGuard>
      );

      expect(await screen.findByText('Protected Content')).toBeInTheDocument();
    });

    it('should show loading state while checking authentication', () => {
      (getToken as jest.Mock).mockReturnValue(undefined);
      
      render(
        <AuthGuard requireAuth={true}>
          <TestContent />
        </AuthGuard>
      );

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  describe('TenantGuard', () => {
    it('should render children when tenant is resolved', () => {
      // Mock tenant context hooks
      const mockUseTenantContext = jest.fn().mockReturnValue({ slug: 'test-salon', isResolved: true });
      const mockUseTenantResolved = jest.fn().mockReturnValue(true);
      
      jest.spyOn(require('../TenantContext'), 'useTenantContext').mockImplementation(mockUseTenantContext);
      jest.spyOn(require('../TenantContext'), 'useTenantResolved').mockImplementation(mockUseTenantResolved);
      
      render(
        <TenantGuard requireTenant={true}>
          <TestContent />
        </TenantGuard>
      );

      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });

    it('should render fallback when tenant is not resolved', () => {
      // Mock tenant context hooks
      const mockUseTenantContext = jest.fn().mockReturnValue({ slug: '', isResolved: false });
      const mockUseTenantResolved = jest.fn().mockReturnValue(false);
      
      jest.spyOn(require('../TenantContext'), 'useTenantContext').mockImplementation(mockUseTenantContext);
      jest.spyOn(require('../TenantContext'), 'useTenantResolved').mockImplementation(mockUseTenantResolved);
      
      render(
        <TenantGuard requireTenant={true} fallback={<FallbackContent />}>
          <TestContent />
        </TenantGuard>
      );

      expect(screen.getByText('Access Denied')).toBeInTheDocument();
    });

    it('should render children when tenant is not required', () => {
      // Mock tenant context
      jest.doMock('../TenantContext', () => ({
        useTenantContext: () => ({ slug: '', isResolved: false }),
        useTenantResolved: () => false,
      }));
      
      render(
        <TenantGuard requireTenant={false}>
          <TestContent />
        </TenantGuard>
      );

      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });
  });

  describe('ProtectedRoute', () => {
    it('should render children when both auth and tenant are satisfied', async () => {
      (getToken as jest.Mock).mockReturnValue('valid-token');
      
      // Mock tenant context
      jest.doMock('../TenantContext', () => ({
        useTenantContext: () => ({ slug: 'test-salon', isResolved: true }),
        useTenantResolved: () => true,
      }));
      
      render(
        <ProtectedRoute requireAuth={true} requireTenant={true}>
          <TestContent />
        </ProtectedRoute>
      );

      expect(await screen.findByText('Protected Content')).toBeInTheDocument();
    });

    it('should render fallback when authentication fails', async () => {
      (getToken as jest.Mock).mockReturnValue(null);
      
      render(
        <ProtectedRoute requireAuth={true} requireTenant={true} fallback={<FallbackContent />}>
          <TestContent />
        </ProtectedRoute>
      );

      expect(await screen.findByText('Access Denied')).toBeInTheDocument();
    });
  });

  describe('PublicRoute', () => {
    it('should always render children', () => {
      render(
        <PublicRoute>
          <TestContent />
        </PublicRoute>
      );

      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });
  });
});
