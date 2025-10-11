/**
 * Environment Configuration Tests
 * 
 * Tests for environment variable validation and configuration.
 */

// Mock import.meta.env
const mockImportMetaEnv = {
  VITE_API_BASE_URL: 'http://localhost:5000/api/v1',
  VITE_SUPABASE_URL: 'https://test.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'test-anon-key',
  VITE_STRIPE_PUBLISHABLE_KEY: 'pk_test_123',
  VITE_SENTRY_DSN: 'https://test-sentry-dsn',
  VITE_ENV: 'test',
};

// Mock import.meta
Object.defineProperty(global, 'import', {
  value: {
    meta: {
      env: mockImportMetaEnv,
    },
  },
});

describe('Environment Configuration', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  describe('config', () => {
    it('should load configuration from environment variables', async () => {
      const { config } = await import('../env');

      expect(config.API_BASE_URL).toBe('http://localhost:5000/api/v1');
      expect(config.SUPABASE_URL).toBe('https://test.supabase.co');
      expect(config.SUPABASE_ANON_KEY).toBe('test-anon-key');
      expect(config.STRIPE_PUBLISHABLE_KEY).toBe('pk_test_123');
      expect(config.SENTRY_DSN).toBe('https://test-sentry-dsn');
      expect(config.ENV).toBe('test');
    });

    it('should set environment flags correctly', async () => {
      const { config } = await import('../env');

      expect(config.IS_DEVELOPMENT).toBe(false);
      expect(config.IS_PRODUCTION).toBe(false);
    });

    it('should set development flag for development environment', async () => {
      // Mock development environment
      Object.defineProperty(global, 'import', {
        value: {
          meta: {
            env: {
              ...mockImportMetaEnv,
              VITE_ENV: 'development',
            },
          },
        },
      });

      const { config } = await import('../env');

      expect(config.IS_DEVELOPMENT).toBe(true);
      expect(config.IS_PRODUCTION).toBe(false);
    });

    it('should set production flag for production environment', async () => {
      // Mock production environment
      Object.defineProperty(global, 'import', {
        value: {
          meta: {
            env: {
              ...mockImportMetaEnv,
              VITE_ENV: 'production',
            },
          },
        },
      });

      const { config } = await import('../env');

      expect(config.IS_DEVELOPMENT).toBe(false);
      expect(config.IS_PRODUCTION).toBe(true);
    });

    it('should default to development environment', async () => {
      // Mock environment without VITE_ENV
      Object.defineProperty(global, 'import', {
        value: {
          meta: {
            env: {
              VITE_API_BASE_URL: 'http://localhost:5000/api/v1',
            },
          },
        },
      });

      const { config } = await import('../env');

      expect(config.ENV).toBe('development');
      expect(config.IS_DEVELOPMENT).toBe(true);
      expect(config.IS_PRODUCTION).toBe(false);
    });
  });

  describe('required environment variables', () => {
    it('should throw error for missing VITE_API_BASE_URL', async () => {
      // Mock environment without required variable
      Object.defineProperty(global, 'import', {
        value: {
          meta: {
            env: {},
          },
        },
      });

      await expect(import('../env')).rejects.toThrow('Missing required environment variable: VITE_API_BASE_URL');
    });

    it('should throw error for empty VITE_API_BASE_URL', async () => {
      // Mock environment with empty required variable
      Object.defineProperty(global, 'import', {
        value: {
          meta: {
            env: {
              VITE_API_BASE_URL: '',
            },
          },
        },
      });

      await expect(import('../env')).rejects.toThrow('Missing required environment variable: VITE_API_BASE_URL');
    });
  });

  describe('token provider', () => {
    it('should have default token provider that returns null', async () => {
      const { getToken } = await import('../env');

      expect(getToken()).toBe(null);
    });

    it('should set and use custom token provider', async () => {
      const { setTokenProvider, getToken } = await import('../env');

      const mockToken = 'test-token';
      const mockProvider = jest.fn().mockReturnValue(mockToken);

      setTokenProvider(mockProvider);

      expect(getToken()).toBe(mockToken);
      expect(mockProvider).toHaveBeenCalled();
    });

    it('should update token provider', async () => {
      const { setTokenProvider, getToken } = await import('../env');

      const mockToken1 = 'test-token-1';
      const mockToken2 = 'test-token-2';
      const mockProvider1 = jest.fn().mockReturnValue(mockToken1);
      const mockProvider2 = jest.fn().mockReturnValue(mockToken2);

      setTokenProvider(mockProvider1);
      expect(getToken()).toBe(mockToken1);

      setTokenProvider(mockProvider2);
      expect(getToken()).toBe(mockToken2);
    });
  });

  describe('constants', () => {
    it('should have correct default rate limit backoff', async () => {
      const { DEFAULT_RATE_LIMIT_BACKOFF_MS } = await import('../env');

      expect(DEFAULT_RATE_LIMIT_BACKOFF_MS).toBe(1000);
    });

    it('should have correct idempotency key header', async () => {
      const { IDEMPOTENCY_KEY_HEADER } = await import('../env');

      expect(IDEMPOTENCY_KEY_HEADER).toBe('Idempotency-Key');
    });
  });

  describe('type safety', () => {
    it('should have correct Config type', async () => {
      const { config, Config } = await import('../env');

      // This test ensures the config object matches the Config type
      const configKeys = Object.keys(config);
      const expectedKeys = [
        'API_BASE_URL',
        'SUPABASE_URL',
        'SUPABASE_ANON_KEY',
        'STRIPE_PUBLISHABLE_KEY',
        'SENTRY_DSN',
        'ENV',
        'IS_DEVELOPMENT',
        'IS_PRODUCTION',
      ];

      expectedKeys.forEach(key => {
        expect(configKeys).toContain(key);
      });
    });
  });
});
