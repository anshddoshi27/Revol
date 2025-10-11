# Environment Configuration

This directory contains environment configuration utilities for the Tithi frontend.

## Files

- `env.ts` - Type-safe runtime environment configuration

## Setup

1. Copy `env.example` to `.env` in the project root
2. Fill in your actual environment variable values
3. The configuration will be validated at runtime

## Environment Variables

### Required Variables

- `VITE_API_BASE_URL` - Base URL for the API (e.g., `http://localhost:5000/api/v1`)

### Optional Variables

- `VITE_SUPABASE_URL` - Supabase project URL for authentication
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key
- `VITE_STRIPE_PUBLISHABLE_KEY` - Stripe publishable key for payments
- `VITE_SENTRY_DSN` - Sentry DSN for error tracking
- `VITE_ENV` - Environment name (defaults to 'development')

## Usage

```typescript
import { config } from '@/lib/env';

// Access configuration values
const apiUrl = config.API_BASE_URL;
const isDev = config.IS_DEVELOPMENT;
```

## Token Provider

The environment configuration also provides a token provider system for authentication:

```typescript
import { setTokenProvider, getToken } from '@/lib/env';

// Set up token provider (typically done in auth service)
setTokenProvider(() => {
  return localStorage.getItem('auth_token');
});

// Get current token
const token = getToken();
```

## Validation

All required environment variables are validated at startup. If any required variables are missing, the application will throw an error with details about which variables are missing.
