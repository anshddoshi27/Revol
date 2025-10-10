/**
 * Environment Configuration
 * 
 * This file provides environment-specific configuration for the Tithi frontend.
 * In production, these values should be set via environment variables.
 */

export const environment = {
  // API Configuration
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1',
  
  // Supabase Configuration
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co',
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key',
  
  // Stripe Configuration
  STRIPE_PUBLISHABLE_KEY: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_...',
  
  // Sentry Configuration
  SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN || 'https://your-sentry-dsn',
  
  // Environment
  ENV: import.meta.env.VITE_ENV || 'development',
  
  // Feature Flags
  IS_DEVELOPMENT: (import.meta.env.VITE_ENV || 'development') === 'development',
  IS_PRODUCTION: (import.meta.env.VITE_ENV || 'development') === 'production',
  
  // Default values for development
  DEFAULT_TENANT_SLUG: 'demo',
  DEFAULT_USER_ID: 'demo-user',
  
  // API Configuration
  API_TIMEOUT: 30000, // 30 seconds
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // 1 second
  
  // Analytics Configuration
  ANALYTICS_ENABLED: true,
  ANALYTICS_SAMPLING_RATE: 1.0, // 100% in development
  
  // Performance Configuration
  WEB_VITALS_ENABLED: true,
  SENTRY_ENABLED: true,
  SENTRY_SAMPLE_RATE: 1.0, // 100% in development
};

export default environment;
