# Observability Module

This module provides comprehensive observability for the Tithi frontend application, including error tracking, performance monitoring, and telemetry.

## Components

### Sentry Integration (`sentry.ts`)
- Error tracking and performance monitoring
- PII scrubbing and data protection
- User and tenant context management
- Session replay and breadcrumb tracking

### Web Vitals (`webVitals.ts`)
- Core Web Vitals collection (LCP, CLS, INP, FCP, TTFB, FID)
- Performance budget tracking
- Real-time performance scoring
- Route-based metric collection

### Telemetry System (`telemetry.ts`)
- Unified event tracking
- Custom metrics collection
- User action tracking
- API request/response monitoring

## Setup

### 1. Initialize Observability

```typescript
import { initTelemetry } from '@/observability';

// Initialize with default configuration
initTelemetry();

// Or with custom configuration
initTelemetry({
  enableSentry: true,
  enableWebVitals: true,
  enableConsoleLogging: true,
  samplingRate: 0.1, // 10% sampling in production
});
```

### 2. Set User Context

```typescript
import { setUserContext, setTenantContext } from '@/observability';

// Set user context
setUserContext('user-123', { username: 'john_doe' });

// Set tenant context
setTenantContext('tenant-456', 'salon-downtown');
```

### 3. Track Events

```typescript
import { trackEvent, trackUserAction, trackPageView } from '@/observability';

// Track custom events
trackEvent('booking_created', {
  booking_id: 'booking-789',
  service_type: 'haircut',
  duration: 60,
});

// Track user actions
trackUserAction('click', 'book_now_button', {
  service_id: 'service-123',
});

// Track page views
trackPageView('/booking/confirmation', {
  booking_id: 'booking-789',
});
```

### 4. Track Errors

```typescript
import { trackError } from '@/observability';

try {
  // Some operation that might fail
  await riskyOperation();
} catch (error) {
  trackError(error, {
    operation: 'booking_creation',
    service_id: 'service-123',
  });
}
```

### 5. Track Performance

```typescript
import { trackMetric } from '@/observability';

// Track custom performance metrics
const startTime = performance.now();
await someOperation();
const duration = performance.now() - startTime;

trackMetric('operation_duration', duration, 'ms', {
  operation: 'data_processing',
});
```

## Environment Variables

The observability system uses the following environment variables:

- `VITE_SENTRY_DSN` - Sentry DSN for error tracking (optional)
- `VITE_ENV` - Environment name (development, staging, production)

## Performance Budgets

The system tracks performance against these budgets:

- **LCP (Largest Contentful Paint)**: 2500ms
- **CLS (Cumulative Layout Shift)**: 0.1
- **INP (Interaction to Next Paint)**: 200ms
- **FCP (First Contentful Paint)**: 1800ms
- **TTFB (Time to First Byte)**: 800ms
- **FID (First Input Delay)**: 100ms

## Privacy and Security

- All PII is automatically scrubbed from Sentry events
- Sensitive data is filtered from breadcrumbs
- User context only includes non-sensitive identifiers
- Sampling rates are applied to reduce data volume

## Development vs Production

- **Development**: Full logging, 100% sampling, detailed console output
- **Production**: Minimal logging, 10% sampling, PII scrubbing enabled

## Integration with API Client

The observability system automatically integrates with the API client to track:

- API request/response times
- Error rates and types
- Rate limiting events
- Authentication failures

## Best Practices

1. **Initialize early**: Call `initTelemetry()` as early as possible in your app
2. **Set context**: Always set user and tenant context when available
3. **Track meaningful events**: Focus on business-critical user actions
4. **Use appropriate sampling**: Adjust sampling rates based on traffic volume
5. **Monitor performance**: Regularly check Web Vitals and performance budgets
6. **Review errors**: Monitor error rates and investigate spikes
