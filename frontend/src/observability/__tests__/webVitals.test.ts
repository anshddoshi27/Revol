/**
 * Web Vitals Tests
 * 
 * Tests for Web Vitals collection, performance budgets, and scoring.
 */

// Mock web-vitals
jest.mock('web-vitals', () => ({
  onCLS: jest.fn(),
  onFID: jest.fn(),
  onFCP: jest.fn(),
  onLCP: jest.fn(),
  onTTFB: jest.fn(),
  onINP: jest.fn(),
}));

// Mock environment configuration
jest.mock('@/lib/env', () => ({
  config: {
    IS_DEVELOPMENT: true,
    IS_PRODUCTION: false,
  },
}));

// Mock window and history
Object.defineProperty(window, 'location', {
  value: {
    pathname: '/test',
  },
  writable: true,
});

Object.defineProperty(global, 'history', {
  value: {
    pushState: jest.fn(),
    replaceState: jest.fn(),
  },
  writable: true,
});

Object.defineProperty(global, 'setTimeout', {
  value: jest.fn((callback) => callback()),
  writable: true,
});

describe('Web Vitals', () => {
  let mockOnCLS: jest.MockedFunction<any>;
  let mockOnFID: jest.MockedFunction<any>;
  let mockOnFCP: jest.MockedFunction<any>;
  let mockOnLCP: jest.MockedFunction<any>;
  let mockOnTTFB: jest.MockedFunction<any>;
  let mockOnINP: jest.MockedFunction<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    const webVitals = require('web-vitals');
    mockOnCLS = webVitals.onCLS;
    mockOnFID = webVitals.onFID;
    mockOnFCP = webVitals.onFCP;
    mockOnLCP = webVitals.onLCP;
    mockOnTTFB = webVitals.onTTFB;
    mockOnINP = webVitals.onINP;

    // Mock console.log for development logging
    jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('initWebVitals', () => {
    it('should initialize all Web Vitals metrics', async () => {
      const { initWebVitals } = await import('../webVitals');

      initWebVitals();

      expect(mockOnCLS).toHaveBeenCalled();
      expect(mockOnFID).toHaveBeenCalled();
      expect(mockOnFCP).toHaveBeenCalled();
      expect(mockOnLCP).toHaveBeenCalled();
      expect(mockOnTTFB).toHaveBeenCalled();
      expect(mockOnINP).toHaveBeenCalled();
    });

    it('should not initialize in non-browser environment', async () => {
      // Mock non-browser environment
      Object.defineProperty(global, 'window', {
        value: undefined,
        writable: true,
      });

      const { initWebVitals } = await import('../webVitals');

      initWebVitals();

      expect(mockOnCLS).not.toHaveBeenCalled();
      expect(mockOnFID).not.toHaveBeenCalled();
      expect(mockOnFCP).not.toHaveBeenCalled();
      expect(mockOnLCP).not.toHaveBeenCalled();
      expect(mockOnTTFB).not.toHaveBeenCalled();
      expect(mockOnINP).not.toHaveBeenCalled();
    });
  });

  describe('Metric Handling', () => {
    it('should handle LCP metric', async () => {
      const { initWebVitals, getCurrentMetrics } = await import('../webVitals');

      initWebVitals();

      // Get the callback function passed to onLCP
      const lcpCallback = mockOnLCP.mock.calls[0][0];

      // Simulate LCP metric
      lcpCallback({
        name: 'LCP',
        value: 2000,
      });

      const metrics = getCurrentMetrics();
      expect(metrics.lcp).toBe(2000);
    });

    it('should handle CLS metric', async () => {
      const { initWebVitals, getCurrentMetrics } = await import('../webVitals');

      initWebVitals();

      const clsCallback = mockOnCLS.mock.calls[0][0];

      clsCallback({
        name: 'CLS',
        value: 0.05,
      });

      const metrics = getCurrentMetrics();
      expect(metrics.cls).toBe(0.05);
    });

    it('should handle INP metric', async () => {
      const { initWebVitals, getCurrentMetrics } = await import('../webVitals');

      initWebVitals();

      const inpCallback = mockOnINP.mock.calls[0][0];

      inpCallback({
        name: 'INP',
        value: 150,
      });

      const metrics = getCurrentMetrics();
      expect(metrics.inp).toBe(150);
    });

    it('should handle FCP metric', async () => {
      const { initWebVitals, getCurrentMetrics } = await import('../webVitals');

      initWebVitals();

      const fcpCallback = mockOnFCP.mock.calls[0][0];

      fcpCallback({
        name: 'FCP',
        value: 1200,
      });

      const metrics = getCurrentMetrics();
      expect(metrics.fcp).toBe(1200);
    });

    it('should handle TTFB metric', async () => {
      const { initWebVitals, getCurrentMetrics } = await import('../webVitals');

      initWebVitals();

      const ttfbCallback = mockOnTTFB.mock.calls[0][0];

      ttfbCallback({
        name: 'TTFB',
        value: 600,
      });

      const metrics = getCurrentMetrics();
      expect(metrics.ttfb).toBe(600);
    });

    it('should handle FID metric', async () => {
      const { initWebVitals, getCurrentMetrics } = await import('../webVitals');

      initWebVitals();

      const fidCallback = mockOnFID.mock.calls[0][0];

      fidCallback({
        name: 'FID',
        value: 80,
      });

      const metrics = getCurrentMetrics();
      expect(metrics.fid).toBe(80);
    });

    it('should log metrics in development', async () => {
      const { initWebVitals } = await import('../webVitals');

      initWebVitals();

      const lcpCallback = mockOnLCP.mock.calls[0][0];

      lcpCallback({
        name: 'LCP',
        value: 2000,
      });

      expect(console.log).toHaveBeenCalledWith(
        'Web Vitals - LCP:',
        expect.objectContaining({
          value: 2000,
          status: 'good',
          route: '/test',
        })
      );
    });
  });

  describe('Callback Management', () => {
    it('should add and call Web Vitals callbacks', async () => {
      const { initWebVitals, addWebVitalsCallback } = await import('../webVitals');

      initWebVitals();

      const mockCallback = jest.fn();
      addWebVitalsCallback(mockCallback);

      const lcpCallback = mockOnLCP.mock.calls[0][0];
      lcpCallback({
        name: 'LCP',
        value: 2000,
      });

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          lcp: 2000,
          route: '/test',
          timestamp: expect.any(Number),
        })
      );
    });

    it('should remove Web Vitals callbacks', async () => {
      const { initWebVitals, addWebVitalsCallback, removeWebVitalsCallback } = await import('../webVitals');

      initWebVitals();

      const mockCallback = jest.fn();
      addWebVitalsCallback(mockCallback);
      removeWebVitalsCallback(mockCallback);

      const lcpCallback = mockOnLCP.mock.calls[0][0];
      lcpCallback({
        name: 'LCP',
        value: 2000,
      });

      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should handle callback errors gracefully', async () => {
      const { initWebVitals, addWebVitalsCallback } = await import('../webVitals');

      initWebVitals();

      const mockCallback = jest.fn().mockImplementation(() => {
        throw new Error('Callback error');
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      addWebVitalsCallback(mockCallback);

      const lcpCallback = mockOnLCP.mock.calls[0][0];
      lcpCallback({
        name: 'LCP',
        value: 2000,
      });

      expect(consoleSpy).toHaveBeenCalledWith('Error in Web Vitals callback:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('Performance Budgets', () => {
    it('should check performance budgets correctly', async () => {
      const { checkPerformanceBudgets, PERFORMANCE_BUDGETS } = await import('../webVitals');

      const metrics = {
        lcp: 2000,
        cls: 0.05,
        inp: 150,
        fcp: 1200,
        ttfb: 600,
        fid: 80,
        route: '/test',
        timestamp: Date.now(),
      };

      const statuses = checkPerformanceBudgets(metrics);

      expect(statuses.lcp).toBe('good');
      expect(statuses.cls).toBe('good');
      expect(statuses.inp).toBe('good');
      expect(statuses.fcp).toBe('good');
      expect(statuses.ttfb).toBe('good');
      expect(statuses.fid).toBe('good');
    });

    it('should identify needs-improvement status', async () => {
      const { checkPerformanceBudgets } = await import('../webVitals');

      const metrics = {
        lcp: 3000, // Between good and poor
        cls: 0.15, // Between good and poor
        inp: 300,  // Between good and poor
        fcp: 2500, // Between good and poor
        ttfb: 1200, // Between good and poor
        fid: 150,  // Between good and poor
        route: '/test',
        timestamp: Date.now(),
      };

      const statuses = checkPerformanceBudgets(metrics);

      expect(statuses.lcp).toBe('needs-improvement');
      expect(statuses.cls).toBe('needs-improvement');
      expect(statuses.inp).toBe('needs-improvement');
      expect(statuses.fcp).toBe('needs-improvement');
      expect(statuses.ttfb).toBe('needs-improvement');
      expect(statuses.fid).toBe('needs-improvement');
    });

    it('should identify poor status', async () => {
      const { checkPerformanceBudgets } = await import('../webVitals');

      const metrics = {
        lcp: 4000, // Poor
        cls: 0.25, // Poor
        inp: 500,  // Poor
        fcp: 3000, // Poor
        ttfb: 1500, // Poor
        fid: 200,  // Poor
        route: '/test',
        timestamp: Date.now(),
      };

      const statuses = checkPerformanceBudgets(metrics);

      expect(statuses.lcp).toBe('poor');
      expect(statuses.cls).toBe('poor');
      expect(statuses.inp).toBe('poor');
      expect(statuses.fcp).toBe('poor');
      expect(statuses.ttfb).toBe('poor');
      expect(statuses.fid).toBe('poor');
    });

    it('should handle null metrics', async () => {
      const { checkPerformanceBudgets } = await import('../webVitals');

      const metrics = {
        lcp: null,
        cls: null,
        inp: null,
        fcp: null,
        ttfb: null,
        fid: null,
        route: '/test',
        timestamp: Date.now(),
      };

      const statuses = checkPerformanceBudgets(metrics);

      expect(Object.keys(statuses)).toHaveLength(0);
    });
  });

  describe('Performance Scoring', () => {
    it('should calculate performance score correctly', async () => {
      const { getPerformanceScore } = await import('../webVitals');

      const metrics = {
        lcp: 2000,
        cls: 0.05,
        inp: 150,
        fcp: 1200,
        ttfb: 600,
        fid: 80,
        route: '/test',
        timestamp: Date.now(),
      };

      const score = getPerformanceScore(metrics);
      expect(score).toBe(100);
    });

    it('should calculate mixed performance score', async () => {
      const { getPerformanceScore } = await import('../webVitals');

      const metrics = {
        lcp: 3000, // needs-improvement
        cls: 0.05, // good
        inp: 150,  // good
        fcp: 1200, // good
        ttfb: 600, // good
        fid: 80,   // good
        route: '/test',
        timestamp: Date.now(),
      };

      const score = getPerformanceScore(metrics);
      expect(score).toBe(92); // (50 + 100 + 100 + 100 + 100 + 100) / 6
    });

    it('should return 0 for no metrics', async () => {
      const { getPerformanceScore } = await import('../webVitals');

      const metrics = {
        lcp: null,
        cls: null,
        inp: null,
        fcp: null,
        ttfb: null,
        fid: null,
        route: '/test',
        timestamp: Date.now(),
      };

      const score = getPerformanceScore(metrics);
      expect(score).toBe(0);
    });
  });

  describe('Metric Formatting', () => {
    it('should format metric values correctly', async () => {
      const { formatMetricValue } = await import('../webVitals');

      expect(formatMetricValue(2000, 'LCP')).toBe('2000ms');
      expect(formatMetricValue(0.05, 'CLS')).toBe('0.050');
      expect(formatMetricValue(150, 'INP')).toBe('150ms');
      expect(formatMetricValue(1200, 'FCP')).toBe('1200ms');
      expect(formatMetricValue(600, 'TTFB')).toBe('600ms');
      expect(formatMetricValue(80, 'FID')).toBe('80ms');
    });

    it('should handle unknown metric types', async () => {
      const { formatMetricValue } = await import('../webVitals');

      expect(formatMetricValue(123, 'UNKNOWN')).toBe('123');
    });
  });

  describe('Route Change Handling', () => {
    it('should reset metrics on route change', async () => {
      const { initWebVitals, getCurrentMetrics } = await import('../webVitals');

      initWebVitals();

      // Set some metrics
      const lcpCallback = mockOnLCP.mock.calls[0][0];
      lcpCallback({
        name: 'LCP',
        value: 2000,
      });

      expect(getCurrentMetrics().lcp).toBe(2000);

      // Simulate route change
      window.location.pathname = '/new-route';
      
      // Get the popstate listener
      const popstateListener = window.addEventListener.mock.calls
        .find(call => call[0] === 'popstate')?.[1];
      
      if (popstateListener) {
        popstateListener();
      }

      expect(getCurrentMetrics().lcp).toBeUndefined();
    });
  });
});
