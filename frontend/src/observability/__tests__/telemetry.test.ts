/**
 * Telemetry System Tests
 * 
 * Tests for the unified telemetry system including event tracking,
 * error tracking, and performance monitoring.
 */

// Mock Sentry
jest.mock('../sentry', () => ({
  initSentry: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  addBreadcrumb: jest.fn(),
}));

// Mock Web Vitals
jest.mock('../webVitals', () => ({
  initWebVitals: jest.fn(),
  addWebVitalsCallback: jest.fn(),
  getPerformanceScore: jest.fn(() => 85),
}));

// Mock environment configuration
jest.mock('@/lib/env', () => ({
  config: {
    SENTRY_DSN: 'https://test-sentry-dsn',
    IS_DEVELOPMENT: true,
    IS_PRODUCTION: false,
  },
}));

// Mock window
Object.defineProperty(global, 'window', {
  value: {
    location: {
      pathname: '/test',
    },
  },
  writable: true,
});

describe('Telemetry System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  describe('initTelemetry', () => {
    it('should initialize with default configuration', async () => {
      const { initTelemetry } = await import('../telemetry');

      initTelemetry();

      const { initSentry } = await import('../sentry');
      const { initWebVitals } = await import('../webVitals');

      expect(initSentry).toHaveBeenCalled();
      expect(initWebVitals).toHaveBeenCalled();
    });

    it('should initialize with custom configuration', async () => {
      const { initTelemetry } = await import('../telemetry');

      const customConfig = {
        enableSentry: false,
        enableWebVitals: false,
        enableConsoleLogging: false,
        samplingRate: 0.5,
      };

      initTelemetry(customConfig);

      const { initSentry } = await import('../sentry');
      const { initWebVitals } = await import('../webVitals');

      expect(initSentry).not.toHaveBeenCalled();
      expect(initWebVitals).not.toHaveBeenCalled();
    });

    it('should not initialize twice', async () => {
      const { initTelemetry } = await import('../telemetry');

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      initTelemetry();
      initTelemetry();

      expect(consoleSpy).toHaveBeenCalledWith('Telemetry already initialized');

      consoleSpy.mockRestore();
    });

    it('should log initialization in development', async () => {
      const { initTelemetry } = await import('../telemetry');

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      initTelemetry();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Telemetry system initialized',
        expect.objectContaining({
          enableSentry: true,
          enableWebVitals: true,
          enableConsoleLogging: true,
          samplingRate: 1.0,
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('trackEvent', () => {
    it('should track event with default options', async () => {
      const { initTelemetry, trackEvent } = await import('../telemetry');

      initTelemetry();

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      trackEvent('test_event', { key: 'value' });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Telemetry Event:',
        expect.objectContaining({
          type: 'custom',
          name: 'test_event',
          data: { key: 'value' },
          route: '/test',
        })
      );

      consoleSpy.mockRestore();
    });

    it('should track event with custom options', async () => {
      const { initTelemetry, trackEvent } = await import('../telemetry');

      initTelemetry();

      const options = {
        userId: 'user-123',
        tenantId: 'tenant-456',
        route: '/custom-route',
      };

      trackEvent('test_event', { key: 'value' }, options);

      const { addBreadcrumb } = await import('../sentry');
      expect(addBreadcrumb).toHaveBeenCalledWith(
        'test_event',
        'telemetry',
        'info',
        { key: 'value' }
      );
    });

    it('should not track event when not initialized', async () => {
      const { trackEvent } = await import('../telemetry');

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      trackEvent('test_event', { key: 'value' });

      expect(consoleSpy).toHaveBeenCalledWith('Telemetry not initialized, skipping event tracking');

      consoleSpy.mockRestore();
    });

    it('should apply sampling rate', async () => {
      const { initTelemetry, trackEvent } = await import('../telemetry');

      initTelemetry({ samplingRate: 0 });

      const { addBreadcrumb } = await import('../sentry');

      trackEvent('test_event', { key: 'value' });

      expect(addBreadcrumb).not.toHaveBeenCalled();
    });
  });

  describe('trackError', () => {
    it('should track error with context', async () => {
      const { initTelemetry, trackError } = await import('../telemetry');

      initTelemetry();

      const error = new Error('Test error');
      const context = { operation: 'test' };

      trackError(error, context);

      const { captureException } = await import('../sentry');
      expect(captureException).toHaveBeenCalledWith(error, {
        operation: 'test',
        route: '/test',
      });
    });

    it('should track error without context', async () => {
      const { initTelemetry, trackError } = await import('../telemetry');

      initTelemetry();

      const error = new Error('Test error');

      trackError(error);

      const { captureException } = await import('../sentry');
      expect(captureException).toHaveBeenCalledWith(error, {
        route: '/test',
      });
    });

    it('should track error with custom options', async () => {
      const { initTelemetry, trackError } = await import('../telemetry');

      initTelemetry();

      const error = new Error('Test error');
      const context = { operation: 'test' };
      const options = {
        userId: 'user-123',
        tenantId: 'tenant-456',
        route: '/custom-route',
      };

      trackError(error, context, options);

      const { captureException } = await import('../sentry');
      expect(captureException).toHaveBeenCalledWith(error, {
        operation: 'test',
        route: '/custom-route',
        userId: 'user-123',
        tenantId: 'tenant-456',
      });
    });

    it('should not track error when not initialized', async () => {
      const { trackError } = await import('../telemetry');

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const error = new Error('Test error');
      trackError(error);

      expect(consoleSpy).toHaveBeenCalledWith('Telemetry not initialized, skipping error tracking');

      consoleSpy.mockRestore();
    });
  });

  describe('trackMetric', () => {
    it('should track metric with default unit', async () => {
      const { initTelemetry, trackMetric } = await import('../telemetry');

      initTelemetry();

      trackMetric('test_metric', 100);

      const { captureMessage } = await import('../sentry');
      expect(captureMessage).toHaveBeenCalledWith(
        'Metric: test_metric',
        'info',
        expect.objectContaining({
          name: 'test_metric',
          value: 100,
          unit: 'ms',
        })
      );
    });

    it('should track metric with custom unit', async () => {
      const { initTelemetry, trackMetric } = await import('../telemetry');

      initTelemetry();

      trackMetric('test_metric', 100, 'bytes');

      const { captureMessage } = await import('../sentry');
      expect(captureMessage).toHaveBeenCalledWith(
        'Metric: test_metric',
        'info',
        expect.objectContaining({
          name: 'test_metric',
          value: 100,
          unit: 'bytes',
        })
      );
    });

    it('should track metric with options', async () => {
      const { initTelemetry, trackMetric } = await import('../telemetry');

      initTelemetry();

      const options = {
        userId: 'user-123',
        tenantId: 'tenant-456',
        route: '/custom-route',
      };

      trackMetric('test_metric', 100, 'ms', options);

      const { captureMessage } = await import('../sentry');
      expect(captureMessage).toHaveBeenCalledWith(
        'Metric: test_metric',
        'info',
        expect.objectContaining({
          name: 'test_metric',
          value: 100,
          unit: 'ms',
          userId: 'user-123',
          tenantId: 'tenant-456',
          route: '/custom-route',
        })
      );
    });

    it('should not track metric when not initialized', async () => {
      const { trackMetric } = await import('../telemetry');

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      trackMetric('test_metric', 100);

      expect(consoleSpy).toHaveBeenCalledWith('Telemetry not initialized, skipping metric tracking');

      consoleSpy.mockRestore();
    });

    it('should apply sampling rate', async () => {
      const { initTelemetry, trackMetric } = await import('../telemetry');

      initTelemetry({ samplingRate: 0 });

      const { captureMessage } = await import('../sentry');

      trackMetric('test_metric', 100);

      expect(captureMessage).not.toHaveBeenCalled();
    });
  });

  describe('trackUserAction', () => {
    it('should track user action', async () => {
      const { initTelemetry, trackUserAction } = await import('../telemetry');

      initTelemetry();

      trackUserAction('click', 'button', { id: 'test-button' });

      const { addBreadcrumb } = await import('../sentry');
      expect(addBreadcrumb).toHaveBeenCalledWith(
        'user_action',
        'telemetry',
        'info',
        expect.objectContaining({
          action: 'click',
          target: 'button',
          id: 'test-button',
        })
      );
    });
  });

  describe('trackPageView', () => {
    it('should track page view', async () => {
      const { initTelemetry, trackPageView } = await import('../telemetry');

      initTelemetry();

      trackPageView('/test-page', { section: 'header' });

      const { addBreadcrumb } = await import('../sentry');
      expect(addBreadcrumb).toHaveBeenCalledWith(
        'page_view',
        'telemetry',
        'info',
        expect.objectContaining({
          route: '/test-page',
          section: 'header',
        })
      );
    });
  });

  describe('trackApiRequest', () => {
    it('should track API request', async () => {
      const { initTelemetry, trackApiRequest } = await import('../telemetry');

      initTelemetry();

      trackApiRequest('GET', '/api/test', 200, 150);

      const { addBreadcrumb } = await import('../sentry');
      expect(addBreadcrumb).toHaveBeenCalledWith(
        'api_request',
        'telemetry',
        'info',
        expect.objectContaining({
          method: 'GET',
          url: '/api/test',
          status: 200,
          duration: 150,
        })
      );
    });
  });

  describe('trackApiError', () => {
    it('should track API error', async () => {
      const { initTelemetry, trackApiError } = await import('../telemetry');

      initTelemetry();

      trackApiError('POST', '/api/test', 500, 'Internal Server Error');

      const { addBreadcrumb } = await import('../sentry');
      expect(addBreadcrumb).toHaveBeenCalledWith(
        'api_error',
        'telemetry',
        'info',
        expect.objectContaining({
          method: 'POST',
          url: '/api/test',
          status: 500,
          error: 'Internal Server Error',
        })
      );
    });
  });

  describe('Context Management', () => {
    it('should set user context', async () => {
      const { initTelemetry, setUserContext } = await import('../telemetry');

      initTelemetry();

      setUserContext('user-123', { username: 'testuser' });

      const { setSentryUser } = await import('../sentry');
      expect(setSentryUser).toHaveBeenCalledWith({
        id: 'user-123',
        username: 'testuser',
      });
    });

    it('should set tenant context', async () => {
      const { initTelemetry, setTenantContext } = await import('../telemetry');

      initTelemetry();

      setTenantContext('tenant-123', 'test-tenant');

      const { setSentryTenant } = await import('../sentry');
      expect(setSentryTenant).toHaveBeenCalledWith('tenant-123', 'test-tenant');
    });
  });

  describe('Utility Functions', () => {
    it('should check if telemetry is initialized', async () => {
      const { isTelemetryInitialized, initTelemetry } = await import('../telemetry');

      expect(isTelemetryInitialized()).toBe(false);

      initTelemetry();

      expect(isTelemetryInitialized()).toBe(true);
    });

    it('should get telemetry configuration', async () => {
      const { getTelemetryConfig, initTelemetry } = await import('../telemetry');

      initTelemetry();

      const config = getTelemetryConfig();

      expect(config).toEqual({
        enableSentry: true,
        enableWebVitals: true,
        enableConsoleLogging: true,
        samplingRate: 1.0,
      });
    });
  });

  describe('Web Vitals Integration', () => {
    it('should add Web Vitals callback on initialization', async () => {
      const { initTelemetry } = await import('../telemetry');

      initTelemetry();

      const { addWebVitalsCallback } = await import('../webVitals');
      expect(addWebVitalsCallback).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should handle Web Vitals callback', async () => {
      const { initTelemetry } = await import('../telemetry');

      initTelemetry();

      const { addWebVitalsCallback } = await import('../webVitals');
      const { captureMessage } = await import('../sentry');

      // Get the callback function
      const callback = addWebVitalsCallback.mock.calls[0][0];

      // Simulate Web Vitals metrics
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

      callback(metrics);

      expect(captureMessage).toHaveBeenCalledWith(
        'Web Vitals collected',
        'info',
        expect.objectContaining({
          performance_score: 85,
          metrics,
        })
      );
    });
  });
});
