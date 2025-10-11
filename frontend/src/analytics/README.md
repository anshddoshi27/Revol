# Analytics Module

This module provides comprehensive analytics event tracking for the Tithi platform, including PII compliance, schema validation, and sampling.

## Overview

The analytics module consists of three main components:

1. **Event Schema** (`event-schema.ts`) - TypeScript definitions for all analytics events
2. **PII Policy** (`pii-policy.ts`) - PII detection, redaction, and compliance utilities
3. **Analytics Service** (`analytics-service.ts`) - Main service for event emission and management

## Features

- ✅ **Complete Event Taxonomy** - 40+ events covering all critical user journeys
- ✅ **PII Compliance** - Automatic detection and redaction of personally identifiable information
- ✅ **Schema Validation** - Strong typing and runtime validation for all events
- ✅ **Sampling** - Configurable sampling rates for different environments
- ✅ **Batch Processing** - Efficient event batching and retry logic
- ✅ **Error Handling** - Comprehensive error handling and logging
- ✅ **Privacy First** - GDPR/CCPA compliant with configurable retention policies

## Quick Start

```typescript
import { emitEvent, setTenantContext, setUserContext } from '@/analytics';

// Set context
setTenantContext('my-business');
setUserContext('user-123');

// Emit events
await emitEvent('onboarding.step_complete', {
  step: 'business_info',
  tenant_id: 'my-business',
  user_id: 'user-123',
  step_duration_ms: 5000,
  previous_step: 'welcome',
});

await emitEvent('booking.service_select', {
  service_id: 'service-123',
  service_name: 'Haircut',
  service_price_cents: 5000,
  service_duration_minutes: 60,
  tenant_id: 'my-business',
  session_id: 'session-456',
});
```

## Event Categories

### Onboarding Events
- `onboarding.step_complete` - User completes an onboarding step
- `onboarding.step_abandon` - User abandons onboarding
- `onboarding.complete` - User completes onboarding

### Booking Events
- `booking.service_select` - User selects a service
- `booking.availability_view` - User views available slots
- `booking.slot_select` - User selects a time slot
- `booking.checkout_start` - User begins checkout
- `booking.checkout_complete` - User completes booking
- `booking.checkout_abandon` - User abandons checkout

### Payment Events
- `payment.intent_create` - Payment intent created
- `payment.intent_success` - Payment succeeds
- `payment.intent_failed` - Payment fails

### Notification Events
- `notification.email_sent` - Email notification sent
- `notification.sms_sent` - SMS notification sent
- `notification.email_delivered` - Email delivered
- `notification.sms_delivered` - SMS delivered

### Loyalty Events
- `loyalty.points_earned` - Customer earns points
- `loyalty.points_redeemed` - Customer redeems points

### Automation Events
- `automation.trigger_fired` - Automation rule triggered
- `automation.action_executed` - Automation action executed

### Admin Events
- `admin.booking_attended` - Admin marks booking as attended
- `admin.booking_no_show` - Admin marks booking as no-show
- `admin.booking_cancelled` - Admin cancels booking
- `admin.service_created` - Admin creates service
- `admin.service_updated` - Admin updates service
- `admin.availability_updated` - Admin updates availability
- `admin.branding_updated` - Admin updates branding

### System Events
- `analytics.schema_loaded` - Analytics schema loaded
- `analytics.event_emitted` - Event successfully emitted
- `analytics.pii_violation` - PII violation detected
- `analytics.schema_violation` - Schema validation failed
- `error.frontend_error` - Frontend error occurred
- `performance.page_load` - Page load performance metrics
- `performance.api_call` - API call performance metrics

## PII Compliance

The analytics module automatically handles PII compliance:

### PII Detection
```typescript
import { detectPii } from '@/analytics';

const result = detectPii({
  user_id: '123',
  email: 'test@example.com',
  service_id: 'service-123',
});

console.log(result.hasPii); // true
console.log(result.piiFields); // ['user_id', 'email']
```

### PII Redaction
```typescript
import { redactPii } from '@/analytics';

const result = redactPii({
  user_id: '123',
  email: 'test@example.com',
  phone: '+1234567890',
});

console.log(result.redactedData);
// {
//   user_id: 'hash_abc123',
//   email: 'hash_def456',
//   phone: '+**********'
// }
```

### PII Validation
```typescript
import { validatePii } from '@/analytics';

const result = validatePii('onboarding.step_complete', {
  step: 'business_info',
  user_id: '123', // Allowed for this event
  email: 'test@example.com', // Not allowed for this event
});

console.log(result.isValid); // false
console.log(result.violations); // Array of violations
```

## Configuration

### Analytics Service Configuration
```typescript
import { AnalyticsService } from '@/analytics';

const analyticsService = new AnalyticsService({
  enabled: true,
  endpoint: '/api/v1/analytics/events',
  batchSize: 10,
  flushInterval: 5000,
  retryAttempts: 3,
  sampling: {
    production: 1.0,
    staging: 0.1,
    development: 0.01,
  },
  piiPolicy: {
    enableDetection: true,
    enableRedaction: true,
    enableValidation: true,
    strictMode: true,
    logViolations: true,
  },
});
```

### PII Policy Configuration
```typescript
import { PiiPolicyValidator } from '@/analytics';

const validator = new PiiPolicyValidator({
  enableDetection: true,
  enableRedaction: true,
  enableValidation: true,
  strictMode: true,
  logViolations: true,
  allowedPiiFields: [],
  blockedPiiFields: ['email', 'phone', 'address'],
});
```

## Sampling

The analytics module supports configurable sampling rates:

- **Production**: 100% sampling for critical events, 10% for high-volume events
- **Staging**: 10% sampling for critical events, 1% for high-volume events  
- **Development**: 1% sampling for critical events, 0.1% for high-volume events

### Custom Sampling
```typescript
await emitEvent('booking.availability_view', eventData, {
  skipSampling: true, // Skip sampling for this event
});
```

## Error Handling

The analytics module provides comprehensive error handling:

- **Schema Validation Errors** - Events that don't match the schema
- **PII Violations** - Events containing blocked PII fields
- **Network Errors** - Failed API calls with retry logic
- **Sampling Errors** - Misconfigured sampling rules

All errors are logged and can be monitored through the `analytics.pii_violation` and `analytics.schema_violation` events.

## Testing

Run the analytics tests:

```bash
npm run test:analytics
```

The test suite covers:
- Event emission and validation
- PII detection and redaction
- Schema validation
- Error handling
- Sampling logic

## Privacy & Compliance

The analytics module is designed with privacy and compliance in mind:

- **GDPR Compliant** - Automatic PII redaction and configurable retention
- **CCPA Compliant** - User consent tracking and data deletion
- **SOC 2 Ready** - Comprehensive audit logging and access controls
- **HIPAA Considerations** - No health information in analytics events

### Data Retention
- **Critical Journey Events**: 365 days
- **Standard Events**: 90 days
- **System Events**: 30 days
- **PII Violations**: 30 days

### PII Redaction Methods
- **Hash** - One-way hash for user IDs, emails, names
- **Mask** - Partial masking for phone numbers, card numbers
- **Remove** - Complete removal of sensitive fields
- **Anonymize** - IP address anonymization

## Integration

### React Hook
```typescript
import { useAnalytics } from '@/hooks/useAnalytics';

function MyComponent() {
  const { emitEvent } = useAnalytics();
  
  const handleClick = () => {
    emitEvent('booking.service_select', {
      service_id: 'service-123',
      service_name: 'Haircut',
      service_price_cents: 5000,
      service_duration_minutes: 60,
      tenant_id: 'my-business',
      session_id: 'session-456',
    });
  };
  
  return <button onClick={handleClick}>Select Service</button>;
}
```

### Middleware Integration
```typescript
import { analyticsMiddleware } from '@/middleware/analytics';

// Add to your middleware stack
app.use(analyticsMiddleware);
```

## Monitoring

Monitor analytics health through:

- **Event Emission Rate** - Track successful event emissions
- **PII Violation Rate** - Monitor compliance violations
- **Schema Validation Rate** - Track schema compliance
- **Sampling Compliance** - Verify sampling rules are working

## Troubleshooting

### Common Issues

1. **Events not being emitted**
   - Check if analytics is enabled
   - Verify tenant/user context is set
   - Check network connectivity

2. **PII violations**
   - Review event data for sensitive fields
   - Check PII policy configuration
   - Verify allowed PII fields for specific events

3. **Schema validation failures**
   - Check event payload structure
   - Verify required fields are present
   - Check field types match schema

### Debug Mode
```typescript
const analyticsService = new AnalyticsService({
  enabled: true,
  debug: true, // Enable debug logging
});
```

## Contributing

When adding new events:

1. Add the event to `analytics-events.json`
2. Add TypeScript interface to `event-schema.ts`
3. Add event constant to `ANALYTICS_EVENTS`
4. Update tests
5. Update documentation

## License

This module is part of the Tithi platform and follows the same licensing terms.
