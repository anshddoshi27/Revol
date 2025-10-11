/**
 * Tenant Context Tests
 * 
 * Tests for tenant context provider and hooks.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { 
  TenantProvider, 
  useTenantSlug, 
  useTenantContext, 
  useTenantResolved 
} from '../TenantContext';

// Mock telemetry
jest.mock('@/observability', () => ({
  telemetry: {
    track: jest.fn(),
  },
}));

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

// Test component that uses tenant hooks
const TestComponent: React.FC = () => {
  const slug = useTenantSlug();
  const context = useTenantContext();
  const isResolved = useTenantResolved();

  return (
    <div>
      <div data-testid="slug">{slug || 'null'}</div>
      <div data-testid="is-resolved">{isResolved.toString()}</div>
      <div data-testid="source">{context?.source || 'null'}</div>
    </div>
  );
};

describe('TenantContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('TenantProvider', () => {
    it('should provide tenant context for path-based routing', () => {
      mockLocation('tithi.com', '/v1/b/acme-salon');
      
      render(
        <TenantProvider>
          <TestComponent />
        </TenantProvider>
      );

      expect(screen.getByTestId('slug')).toHaveTextContent('acme-salon');
      expect(screen.getByTestId('is-resolved')).toHaveTextContent('true');
      expect(screen.getByTestId('source')).toHaveTextContent('path');
    });

    it('should provide tenant context for subdomain routing', () => {
      mockLocation('acme-salon.tithi.com', '/');
      
      render(
        <TenantProvider>
          <TestComponent />
        </TenantProvider>
      );

      expect(screen.getByTestId('slug')).toHaveTextContent('acme-salon');
      expect(screen.getByTestId('is-resolved')).toHaveTextContent('true');
      expect(screen.getByTestId('source')).toHaveTextContent('subdomain');
    });

    it('should handle unresolved tenant state', () => {
      mockLocation('www.example.com', '/');
      
      render(
        <TenantProvider>
          <TestComponent />
        </TenantProvider>
      );

      expect(screen.getByTestId('slug')).toHaveTextContent('null');
      expect(screen.getByTestId('is-resolved')).toHaveTextContent('false');
      expect(screen.getByTestId('source')).toHaveTextContent('null');
    });
  });

  describe('useTenantSlug', () => {
    it('should return tenant slug when resolved', () => {
      mockLocation('tithi.com', '/v1/b/test-salon');
      
      render(
        <TenantProvider>
          <TestComponent />
        </TenantProvider>
      );

      expect(screen.getByTestId('slug')).toHaveTextContent('test-salon');
    });

    it('should return null when not resolved', () => {
      mockLocation('www.example.com', '/');
      
      render(
        <TenantProvider>
          <TestComponent />
        </TenantProvider>
      );

      expect(screen.getByTestId('slug')).toHaveTextContent('null');
    });
  });

  describe('useTenantResolved', () => {
    it('should return true when tenant is resolved', () => {
      mockLocation('tithi.com', '/v1/b/test-salon');
      
      render(
        <TenantProvider>
          <TestComponent />
        </TenantProvider>
      );

      expect(screen.getByTestId('is-resolved')).toHaveTextContent('true');
    });

    it('should return false when tenant is not resolved', () => {
      mockLocation('www.example.com', '/');
      
      render(
        <TenantProvider>
          <TestComponent />
        </TenantProvider>
      );

      expect(screen.getByTestId('is-resolved')).toHaveTextContent('false');
    });
  });

  describe('useTenantContext', () => {
    it('should return full tenant context', () => {
      mockLocation('tithi.com', '/v1/b/test-salon');
      
      render(
        <TenantProvider>
          <TestComponent />
        </TenantProvider>
      );

      expect(screen.getByTestId('source')).toHaveTextContent('path');
    });
  });
});
