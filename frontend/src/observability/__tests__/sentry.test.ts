/**
 * Sentry Integration Tests
 * 
 * Tests for Sentry initialization, error tracking, and PII scrubbing.
 */

import * as Sentry from '@sentry/react';

// Mock Sentry
jest.mock('@sentry/react', () => ({
  init: jest.fn(),
  setUser: jest.fn(),
  setContext: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  addBreadcrumb: jest.fn(),
  startTransaction: jest.fn(),
  getCurrentScope: jest.fn(),
  getCurrentHub: jest.fn(() => ({
    getClient: jest.fn(() => ({})),
  })),
  withScope: jest.fn((callback) => callback({
    setContext: jest.fn(),
  })),
}));

// Mock environment configuration
jest.mock('@/lib/env', () => ({
  config: {
    SENTRY_DSN: 'https://test-sentry-dsn',
    ENV: 'test',
    IS_PRODUCTION: false,
  },
}));

describe('Sentry Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initSentry', () => {
    it('should initialize Sentry with correct configuration', async () => {
      const { initSentry } = await import('../sentry');

      initSentry();

      expect(Sentry.init).toHaveBeenCalledWith({
        dsn: 'https://test-sentry-dsn',
        environment: 'test',
        tracesSampleRate: 1.0,
        replaysSessionSampleRate: 0.1,
        replaysOnErrorSampleRate: 1.0,
        beforeSend: expect.any(Function),
        beforeBreadcrumb: expect.any(Function),
        integrations: expect.any(Array),
      });
    });

    it('should not initialize Sentry without DSN', async () => {
      // Mock environment without Sentry DSN
      jest.doMock('@/lib/env', () => ({
        config: {
          SENTRY_DSN: undefined,
          ENV: 'test',
          IS_PRODUCTION: false,
        },
      }));

      const { initSentry } = await import('../sentry');

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      initSentry();

      expect(Sentry.init).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Sentry DSN not provided, skipping Sentry initialization');

      consoleSpy.mockRestore();
    });

    it('should use production sampling rates in production', async () => {
      // Mock production environment
      jest.doMock('@/lib/env', () => ({
        config: {
          SENTRY_DSN: 'https://test-sentry-dsn',
          ENV: 'production',
          IS_PRODUCTION: true,
        },
      }));

      const { initSentry } = await import('../sentry');

      initSentry();

      expect(Sentry.init).toHaveBeenCalledWith(
        expect.objectContaining({
          tracesSampleRate: 0.1,
          replaysSessionSampleRate: 0.01,
        })
      );
    });

    it('should allow configuration overrides', async () => {
      const { initSentry } = await import('../sentry');

      const customConfig = {
        tracesSampleRate: 0.5,
        replaysSessionSampleRate: 0.2,
      };

      initSentry(customConfig);

      expect(Sentry.init).toHaveBeenCalledWith(
        expect.objectContaining(customConfig)
      );
    });
  });

  describe('PII Scrubbing', () => {
    it('should scrub PII from user context', async () => {
      const { initSentry } = await import('../sentry');

      initSentry();

      const beforeSend = Sentry.init.mock.calls[0][0].beforeSend;
      const event = {
        user: {
          id: 'user-123',
          email: 'user@example.com',
          phone: '+1234567890',
          username: 'testuser',
        },
      };

      const result = beforeSend(event);

      expect(result.user).toEqual({
        id: 'user-123',
      });
      expect(result.user.email).toBeUndefined();
      expect(result.user.phone).toBeUndefined();
    });

    it('should scrub sensitive data from extra context', async () => {
      const { initSentry } = await import('../sentry');

      initSentry();

      const beforeSend = Sentry.init.mock.calls[0][0].beforeSend;
      const event = {
        extra: {
          email: 'user@example.com',
          password: 'secret123',
          token: 'jwt-token',
          api_key: 'api-key-123',
          credit_card: '4111-1111-1111-1111',
          ssn: '123-45-6789',
          normal_data: 'safe-data',
        },
      };

      const result = beforeSend(event);

      expect(result.extra).toEqual({
        normal_data: 'safe-data',
      });
    });

    it('should scrub sensitive data from tags', async () => {
      const { initSentry } = await import('../sentry');

      initSentry();

      const beforeSend = Sentry.init.mock.calls[0][0].beforeSend;
      const event = {
        tags: {
          email: 'user@example.com',
          phone: '+1234567890',
          user_email: 'user@example.com',
          normal_tag: 'safe-tag',
        },
      };

      const result = beforeSend(event);

      expect(result.tags).toEqual({
        normal_tag: 'safe-tag',
      });
    });

    it('should scrub sensitive data from URLs', async () => {
      const { initSentry } = await import('../sentry');

      initSentry();

      const beforeSend = Sentry.init.mock.calls[0][0].beforeSend;
      const event = {
        request: {
          url: 'https://api.example.com/users?token=secret&key=value&normal=param',
        },
      };

      const result = beforeSend(event);

      expect(result.request.url).toBe('https://api.example.com/users?normal=param');
    });

    it('should return null for null event', async () => {
      const { initSentry } = await import('../sentry');

      initSentry();

      const beforeSend = Sentry.init.mock.calls[0][0].beforeSend;

      expect(beforeSend(null)).toBe(null);
    });
  });

  describe('Breadcrumb Filtering', () => {
    it('should filter sensitive data from breadcrumbs', async () => {
      const { initSentry } = await import('../sentry');

      initSentry();

      const beforeBreadcrumb = Sentry.init.mock.calls[0][0].beforeBreadcrumb;
      const breadcrumb = {
        message: 'API call to https://api.example.com?token=secret',
        data: {
          password: 'secret123',
          token: 'jwt-token',
          normal_data: 'safe-data',
        },
      };

      const result = beforeBreadcrumb(breadcrumb);

      expect(result.data).toEqual({
        normal_data: 'safe-data',
      });
      expect(result.message).toBe('API call to https://api.example.com');
    });

    it('should return null for null breadcrumb', async () => {
      const { initSentry } = await import('../sentry');

      initSentry();

      const beforeBreadcrumb = Sentry.init.mock.calls[0][0].beforeBreadcrumb;

      expect(beforeBreadcrumb(null)).toBe(null);
    });
  });

  describe('User and Context Management', () => {
    it('should set user context', async () => {
      const { setSentryUser } = await import('../sentry');

      const user = {
        id: 'user-123',
        email: 'user@example.com',
        username: 'testuser',
      };

      setSentryUser(user);

      expect(Sentry.setUser).toHaveBeenCalledWith({
        id: 'user-123',
        username: 'testuser',
      });
    });

    it('should set tenant context', async () => {
      const { setSentryTenant } = await import('../sentry');

      setSentryTenant('tenant-123', 'test-tenant');

      expect(Sentry.setContext).toHaveBeenCalledWith('tenant', {
        id: 'tenant-123',
        slug: 'test-tenant',
      });
    });

    it('should set additional context', async () => {
      const { setSentryContext } = await import('../sentry');

      setSentryContext('custom', { key: 'value' });

      expect(Sentry.setContext).toHaveBeenCalledWith('custom', { key: 'value' });
    });
  });

  describe('Error and Message Capture', () => {
    it('should capture exception without context', async () => {
      const { captureException } = await import('../sentry');

      const error = new Error('Test error');
      captureException(error);

      expect(Sentry.captureException).toHaveBeenCalledWith(error);
    });

    it('should capture exception with context', async () => {
      const { captureException } = await import('../sentry');

      const error = new Error('Test error');
      const context = { operation: 'test' };

      captureException(error, context);

      expect(Sentry.withScope).toHaveBeenCalled();
      expect(Sentry.captureException).toHaveBeenCalledWith(error);
    });

    it('should capture message without context', async () => {
      const { captureMessage } = await import('../sentry');

      captureMessage('Test message', 'info');

      expect(Sentry.captureMessage).toHaveBeenCalledWith('Test message', 'info');
    });

    it('should capture message with context', async () => {
      const { captureMessage } = await import('../sentry');

      const context = { operation: 'test' };

      captureMessage('Test message', 'info', context);

      expect(Sentry.withScope).toHaveBeenCalled();
      expect(Sentry.captureMessage).toHaveBeenCalledWith('Test message', 'info');
    });

    it('should add breadcrumb', async () => {
      const { addBreadcrumb } = await import('../sentry');

      addBreadcrumb('Test message', 'test', 'info', { key: 'value' });

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        message: 'Test message',
        category: 'test',
        level: 'info',
        data: { key: 'value' },
        timestamp: expect.any(Number),
      });
    });
  });

  describe('Transaction Management', () => {
    it('should start transaction', async () => {
      const { startTransaction } = await import('../sentry');

      const mockTransaction = { name: 'test', op: 'test' };
      Sentry.startTransaction.mockReturnValue(mockTransaction);

      const result = startTransaction('test', 'test');

      expect(Sentry.startTransaction).toHaveBeenCalledWith({ name: 'test', op: 'test' });
      expect(result).toBe(mockTransaction);
    });

    it('should get current scope', async () => {
      const { getCurrentScope } = await import('../sentry');

      const mockScope = { setContext: jest.fn() };
      Sentry.getCurrentScope.mockReturnValue(mockScope);

      const result = getCurrentScope();

      expect(Sentry.getCurrentScope).toHaveBeenCalled();
      expect(result).toBe(mockScope);
    });
  });

  describe('Initialization Check', () => {
    it('should check if Sentry is initialized', async () => {
      const { isSentryInitialized } = await import('../sentry');

      const mockClient = {};
      Sentry.getCurrentHub().getClient.mockReturnValue(mockClient);

      const result = isSentryInitialized();

      expect(result).toBe(true);
    });

    it('should return false when Sentry is not initialized', async () => {
      const { isSentryInitialized } = await import('../sentry');

      Sentry.getCurrentHub().getClient.mockReturnValue(null);

      const result = isSentryInitialized();

      expect(result).toBe(false);
    });
  });
});
