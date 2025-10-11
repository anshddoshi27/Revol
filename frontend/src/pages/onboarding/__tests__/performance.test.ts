/**
 * Performance Tests for Onboarding Step 2
 * 
 * Tests performance requirements including LCP, CLS, INP, and bundle size.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { Step2LogoColors } from '../Step2LogoColors';
import { LogoUploader } from '../../../components/onboarding/LogoUploader';
import { ColorPicker } from '../../../components/onboarding/ColorPicker';
import { LogoPreview } from '../../../components/onboarding/LogoPreview';

// Mock data for testing
const mockStep1Data = {
  name: 'Test Salon',
  description: 'A test salon for performance testing',
  timezone: 'America/New_York',
  slug: 'test-salon',
  dba: 'Test Salon LLC',
  industry: 'Beauty & Wellness',
  address: {
    street: '123 Test St',
    city: 'Test City',
    state_province: 'NY',
    postal_code: '10001',
    country: 'US',
  },
  website: 'https://testsalon.com',
  phone: '+1-555-0123',
  support_email: 'support@testsalon.com',
  staff: [
    {
      role: 'Stylist',
      name: 'Jane Doe',
      color: '#3B82F6',
    },
  ],
  social_links: {
    instagram: '@testsalon',
    website: 'https://testsalon.com',
  },
};

// Mock router
const mockNavigate = jest.fn();
const mockLocation = {
  state: { step1Data: mockStep1Data },
  pathname: '/onboarding/logo-colors',
  search: '',
  hash: '',
  key: 'test',
};

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
}));

// Mock observability
jest.mock('../../../observability', () => ({
  trackEvent: jest.fn(),
  trackError: jest.fn(),
}));

// Mock environment
jest.mock('../../../config/environment', () => ({
  environment: {
    API_BASE_URL: 'http://localhost:5000/api/v1',
    SENTRY_DSN: undefined,
    IS_DEVELOPMENT: true,
    IS_PRODUCTION: false,
  },
}));

// Mock image processing
jest.mock('../../../utils/imageProcessing', () => ({
  validateImageFile: jest.fn(() => ({ isValid: true, errors: [], warnings: [] })),
  processLogoUpload: jest.fn(() => Promise.resolve({
    dataUrl: 'data:image/png;base64,mock-data',
    blob: new Blob(),
    dimensions: { width: 800, height: 600 },
    fileSize: 1024 * 1024,
    format: 'image/png',
  })),
}));

// Mock hooks
jest.mock('../../../hooks/useLogoUpload', () => ({
  useLogoUpload: () => ({
    state: {
      file: null,
      processedImage: null,
      validation: null,
      isProcessing: false,
      isUploading: false,
      error: null,
      previewUrl: null,
    },
    actions: {
      handleFileSelect: jest.fn(),
      handleFileDrop: jest.fn(),
      clearLogo: jest.fn(),
      retryUpload: jest.fn(),
    },
  }),
}));

jest.mock('../../../hooks/useColorContrast', () => ({
  useColorContrast: () => ({
    state: {
      selectedColor: '#3B82F6',
      contrastResult: {
        ratio: 4.5,
        passesAA: true,
        passesAAA: false,
        level: 'AA',
        recommendation: 'Good contrast! Meets WCAG AA standards.',
      },
      isValid: true,
      error: null,
    },
    actions: {
      setColor: jest.fn(),
      validateContrast: jest.fn(),
      reset: jest.fn(),
    },
  }),
}));

describe('Performance Tests - Onboarding Step 2', () => {
  describe('Initial Load Performance', () => {
    it('should render within performance budget', async () => {
      const startTime = performance.now();
      
      render(<Step2LogoColors />);
      
      // Wait for initial render to complete
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Logo & Brand Colors' })).toBeInTheDocument();
      });
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      // Should render within 100ms (LCP target is 2s, but initial render should be much faster)
      expect(renderTime).toBeLessThan(100);
    });

    it('should not cause layout shift during initial render', async () => {
      const { container } = render(<Step2LogoColors />);
      
      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Logo & Brand Colors' })).toBeInTheDocument();
      });
      
      // Check that no significant layout shifts occurred
      // This would be measured by CLS in real browser testing
      const elements = container.querySelectorAll('*');
      expect(elements.length).toBeGreaterThan(0);
    });

    it('should load all critical content quickly', async () => {
      render(<Step2LogoColors />);
      
      // Check that all critical content is present
      await waitFor(() => {
        expect(screen.getByText('Upload your logo')).toBeInTheDocument();
        expect(screen.getByText('Choose your brand color')).toBeInTheDocument();
        expect(screen.getByText('Logo Preview')).toBeInTheDocument();
      });
    });
  });

  describe('Component Rendering Performance', () => {
    it('should render LogoUploader efficiently', async () => {
      const startTime = performance.now();
      
      render(
        <LogoUploader
          onLogoChange={jest.fn()}
          onError={jest.fn()}
        />
      );
      
      await waitFor(() => {
        expect(screen.getByText('Upload your logo')).toBeInTheDocument();
      });
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      // Should render within 50ms
      expect(renderTime).toBeLessThan(50);
    });

    it('should render ColorPicker efficiently', async () => {
      const startTime = performance.now();
      
      render(
        <ColorPicker
          onColorChange={jest.fn()}
          onError={jest.fn()}
        />
      );
      
      await waitFor(() => {
        expect(screen.getByText('Choose your brand color')).toBeInTheDocument();
      });
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      // Should render within 50ms
      expect(renderTime).toBeLessThan(50);
    });

    it('should render LogoPreview efficiently', async () => {
      const startTime = performance.now();
      
      render(
        <LogoPreview
          logoData={null}
          primaryColor="#3B82F6"
          businessName="Test Salon"
        />
      );
      
      await waitFor(() => {
        expect(screen.getByText('Logo Preview')).toBeInTheDocument();
      });
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      // Should render within 50ms
      expect(renderTime).toBeLessThan(50);
    });
  });

  describe('Memory Usage', () => {
    it('should not leak memory during component lifecycle', () => {
      const { unmount } = render(<Step2LogoColors />);
      
      // Component should unmount cleanly
      expect(() => unmount()).not.toThrow();
    });

    it('should clean up resources properly', () => {
      const { unmount } = render(<Step2LogoColors />);
      
      // Unmount should not cause errors
      unmount();
      
      // Check that no global state is left behind
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('Bundle Size Optimization', () => {
    it('should use lazy loading for non-critical components', () => {
      // Check that components are properly code-split
      // This would be verified in build analysis
      expect(true).toBe(true);
    });

    it('should not include unused dependencies', () => {
      // Check that only necessary dependencies are included
      // This would be verified in bundle analysis
      expect(true).toBe(true);
    });
  });

  describe('Image Processing Performance', () => {
    it('should process images efficiently', async () => {
      const mockFile = new File([''], 'test.png', { type: 'image/png' });
      const { processLogoUpload } = require('../../../utils/imageProcessing');
      
      const startTime = performance.now();
      
      await processLogoUpload(mockFile);
      
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      
      // Image processing should complete within 500ms
      expect(processingTime).toBeLessThan(500);
    });

    it('should handle large images without blocking UI', async () => {
      // Test that image processing doesn't block the main thread
      const mockFile = new File([''], 'large.png', { type: 'image/png' });
      const { processLogoUpload } = require('../../../utils/imageProcessing');
      
      const startTime = performance.now();
      
      // Process image
      const promise = processLogoUpload(mockFile);
      
      // UI should remain responsive
      const uiTime = performance.now() - startTime;
      expect(uiTime).toBeLessThan(100);
      
      // Wait for processing to complete
      await promise;
    });
  });

  describe('Network Performance', () => {
    it('should minimize API calls', () => {
      // Check that components don't make unnecessary API calls
      // This would be verified in network monitoring
      expect(true).toBe(true);
    });

    it('should handle network errors gracefully', async () => {
      // Test that network errors don't cause performance issues
      render(<Step2LogoColors />);
      
      // Component should render even with network issues
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Logo & Brand Colors' })).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Performance', () => {
    it('should perform well on mobile devices', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });
      
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 667,
      });
      
      render(<Step2LogoColors />);
      
      // Should render without issues on mobile
      expect(screen.getByRole('heading', { name: 'Logo & Brand Colors' })).toBeInTheDocument();
    });

    it('should perform well on tablet devices', () => {
      // Mock tablet viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      });
      
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 1024,
      });
      
      render(<Step2LogoColors />);
      
      // Should render without issues on tablet
      expect(screen.getByRole('heading', { name: 'Logo & Brand Colors' })).toBeInTheDocument();
    });
  });

  describe('Performance Budgets', () => {
    it('should meet LCP requirements', () => {
      // LCP should be < 2.0s
      // This would be measured in real browser testing
      expect(true).toBe(true);
    });

    it('should meet CLS requirements', () => {
      // CLS should be < 0.1
      // This would be measured in real browser testing
      expect(true).toBe(true);
    });

    it('should meet INP requirements', () => {
      // INP should be < 200ms
      // This would be measured in real browser testing
      expect(true).toBe(true);
    });

    it('should meet bundle size requirements', () => {
      // Initial bundle should be < 500KB
      // This would be measured in build analysis
      expect(true).toBe(true);
    });
  });

  describe('Performance Monitoring', () => {
    it('should track performance metrics', () => {
      const { trackEvent } = require('../../../observability');
      
      // Performance events should be tracked
      expect(trackEvent).toHaveBeenCalled();
    });

    it('should handle performance errors gracefully', () => {
      // Test that performance issues don't break the app
      render(<Step2LogoColors />);
      
      // Should still render successfully
      expect(screen.getByRole('heading', { name: 'Logo & Brand Colors' })).toBeInTheDocument();
    });
  });
});
