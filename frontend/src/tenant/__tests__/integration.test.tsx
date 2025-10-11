/**
 * Tenant Integration Tests
 * 
 * End-to-end integration tests for tenant resolution and route guards.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { TenantProvider, ProtectedRoute, PublicRoute } from '../index';

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
const mockLocation = (hostname: string, pathname: string) => {
  Object.defineProperty(window, 'location', {
    value: {
      hostname,
      pathname,
    },
    writable: true,
  });
};

const TestContent: React.FC = () => <div>Test Content</div>;
const FallbackContent: React.FC = () => <div>Access Denied</div>;

describe('Tenant Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Public Booking Flow', () => {
    it('should allow access to public booking routes without authentication', async () => {
      mockLocation('tithi.com', '/v1/b/acme-salon/services');
      (getToken as jest.Mock).mockReturnValue(null);
      
      render(
        <TenantProvider>
          <PublicRoute>
            <TestContent />
          </PublicRoute>
        </TenantProvider>
      );

      expect(await screen.findByText('Test Content')).toBeInTheDocument();
    });

    it('should resolve tenant context for public booking routes', async () => {
      mockLocation('tithi.com', '/v1/b/acme-salon');
      
      const TestComponent: React.FC = () => {
        const { useTenantSlug } = require('../TenantContext');
        const slug = useTenantSlug();
        return <div data-testid="tenant-slug">{slug}</div>;
      };
      
      render(
        <TenantProvider>
          <TestComponent />
        </TenantProvider>
      );

      expect(await screen.findByTestId('tenant-slug')).toHaveTextContent('acme-salon');
    });
  });

  describe('Admin Flow', () => {
    it('should block access to admin routes without authentication', async () => {
      mockLocation('tithi.com', '/admin/dashboard');
      (getToken as jest.Mock).mockReturnValue(null);
      
      render(
        <TenantProvider>
          <ProtectedRoute requireAuth={true} requireTenant={true} fallback={<FallbackContent />}>
            <TestContent />
          </ProtectedRoute>
        </TenantProvider>
      );

      expect(await screen.findByText('Access Denied')).toBeInTheDocument();
    });

    it('should allow access to admin routes with authentication', async () => {
      mockLocation('tithi.com', '/admin/dashboard');
      (getToken as jest.Mock).mockReturnValue('valid-token');
      
      render(
        <TenantProvider>
          <ProtectedRoute requireAuth={true} requireTenant={true}>
            <TestContent />
          </ProtectedRoute>
        </TenantProvider>
      );

      expect(await screen.findByText('Test Content')).toBeInTheDocument();
    });
  });

  describe('Subdomain Routing', () => {
    it('should resolve tenant from subdomain', async () => {
      mockLocation('acme-salon.tithi.com', '/');
      
      const TestComponent: React.FC = () => {
        const { useTenantSlug, useTenantContext } = require('../TenantContext');
        const slug = useTenantSlug();
        const context = useTenantContext();
        return (
          <div>
            <div data-testid="tenant-slug">{slug}</div>
            <div data-testid="tenant-source">{context?.source}</div>
          </div>
        );
      };
      
      render(
        <TenantProvider>
          <TestComponent />
        </TenantProvider>
      );

      expect(await screen.findByTestId('tenant-slug')).toHaveTextContent('acme-salon');
      expect(await screen.findByTestId('tenant-source')).toHaveTextContent('subdomain');
    });
  });

  describe('Route Transitions', () => {
    it('should handle route transitions correctly', async () => {
      // Start with public booking route
      mockLocation('tithi.com', '/v1/b/acme-salon');
      
      const TestComponent: React.FC = () => {
        const { useTenantSlug } = require('../TenantContext');
        const slug = useTenantSlug();
        return <div data-testid="tenant-slug">{slug}</div>;
      };
      
      const { rerender } = render(
        <TenantProvider>
          <TestComponent />
        </TenantProvider>
      );

      expect(await screen.findByTestId('tenant-slug')).toHaveTextContent('acme-salon');

      // Transition to different tenant
      mockLocation('tithi.com', '/v1/b/different-salon');
      
      rerender(
        <TenantProvider>
          <TestComponent />
        </TenantProvider>
      );

      expect(await screen.findByTestId('tenant-slug')).toHaveTextContent('different-salon');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing tenant gracefully', async () => {
      mockLocation('tithi.com', '/');
      
      const TestComponent: React.FC = () => {
        const { useTenantResolved } = require('../TenantContext');
        const isResolved = useTenantResolved();
        return <div data-testid="is-resolved">{isResolved.toString()}</div>;
      };
      
      render(
        <TenantProvider>
          <TestComponent />
        </TenantProvider>
      );

      expect(await screen.findByTestId('is-resolved')).toHaveTextContent('false');
    });
  });
});
