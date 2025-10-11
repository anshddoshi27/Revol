/**
 * Environment Configuration
 * 
 * Type-safe runtime environment configuration for the Tithi frontend.
 * Validates required environment variables and provides defaults.
 */

// Import environment configuration
import { environment } from '../config/environment';

// Export validated configuration
export const config = {
  // API Configuration
  API_BASE_URL: environment.API_BASE_URL,
  
  // Supabase Configuration
  SUPABASE_URL: environment.SUPABASE_URL,
  SUPABASE_ANON_KEY: environment.SUPABASE_ANON_KEY,
  
  // Stripe Configuration
  STRIPE_PUBLISHABLE_KEY: environment.STRIPE_PUBLISHABLE_KEY,
  
  // Sentry Configuration
  SENTRY_DSN: environment.SENTRY_DSN,
  
  // Environment
  ENV: environment.ENV,
  
  // Feature Flags
  IS_DEVELOPMENT: environment.IS_DEVELOPMENT,
  IS_PRODUCTION: environment.IS_PRODUCTION,
} as const;

// Type for environment configuration
export type Config = typeof config;

// Default rate limiting configuration
export const DEFAULT_RATE_LIMIT_BACKOFF_MS = 1000;
export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';

// Token provider type and implementation
export type TokenProvider = () => string | null;

let tokenProvider: TokenProvider = () => null;

export const setTokenProvider = (provider: TokenProvider) => {
  tokenProvider = provider;
};

export const getToken = (): string | null => tokenProvider();
