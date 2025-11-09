# Tithi Payments Appendix

**Purpose**: Comprehensive guide to all payment methods, workflows, and edge cases for the Tithi frontend.

**Confidence Score**: 95% - Based on detailed analysis of Stripe integration and payment flows.

## Payment Architecture Overview

### Payment Provider
- **Primary**: Stripe (PaymentIntents, SetupIntents, Connect)
- **Webhooks**: Stripe webhook events
- **Idempotency**: Required for all payment operations
- **Multi-tenancy**: Stripe Connect for tenant isolation

### Payment Flow States
```typescript
type PaymentStatus = 
  | 'requires_action'    // Needs customer action
  | 'requires_confirmation' // Needs server confirmation
  | 'requires_payment_method' // Needs payment method
  | 'processing'         // Payment processing
  | 'succeeded'          // Payment successful
  | 'failed'             // Payment failed
  | 'canceled'           // Payment canceled
  | 'refunded'           // Payment refunded
```

## Supported Payment Methods

### 1. Credit/Debit Cards (Stripe)

#### Frontend Implementation
```typescript
// Component: CardPaymentForm
// Library: @stripe/stripe-js
// Elements: CardElement, CardNumberElement
// Validation: Stripe Elements validation
// Security: PCI compliant
```

#### Backend Integration
```typescript
// Endpoint: POST /api/payments/intent
// Stripe API: PaymentIntents.create()
// Database: payments table
// Idempotency: Required
```

#### Request/Response Flow
```http
POST /api/payments/intent
Authorization: Bearer <token>
Content-Type: application/json

{
  "booking_id": "uuid",
  "amount_cents": 5000,
  "currency": "USD",
  "customer_id": "uuid",
  "idempotency_key": "unique_key",
  "payment_method": "card"
}
```

```json
{
  "id": "payment_uuid",
  "booking_id": "booking_uuid",
  "customer_id": "customer_uuid",
  "amount_cents": 5000,
  "currency_code": "USD",
  "status": "requires_action",
  "method": "card",
  "provider_payment_id": "pi_stripe_id",
  "client_secret": "pi_stripe_client_secret",
  "created_at": "2024-01-01T00:00:00Z"
}
```

#### Confirmation Flow
```http
POST /api/payments/intent/{payment_id}/confirm
Authorization: Bearer <token>
Content-Type: application/json

{
  "payment_method_id": "pm_stripe_id"
}
```

### 2. Apple Pay (Stripe)

#### Frontend Implementation
```typescript
// Component: ApplePayButton
// Library: @stripe/stripe-js
// Element: ApplePayButtonElement
// Requirements: HTTPS, Apple Pay enabled
// Validation: Apple Pay validation
```

#### Backend Integration
```typescript
// Endpoint: POST /api/payments/intent
// Stripe API: PaymentIntents.create()
// Database: payments table
// Method: "apple_pay"
```

#### Apple Pay Flow
```typescript
// 1. Check Apple Pay availability
const applePay = await stripe.applePay.isAvailable();

// 2. Create payment intent
const paymentIntent = await createPaymentIntent({
  method: "apple_pay",
  amount_cents: 5000
});

// 3. Confirm with Apple Pay
const result = await stripe.confirmApplePayPayment(
  paymentIntent.client_secret,
  {
    country: 'US',
    currency: 'usd',
    requiredBillingContactFields: ['email'],
    requiredShippingContactFields: ['email']
  }
);
```

### 3. Google Pay (Stripe)

#### Frontend Implementation
```typescript
// Component: GooglePayButton
// Library: @stripe/stripe-js
// Element: GooglePayButtonElement
// Requirements: HTTPS, Google Pay enabled
// Validation: Google Pay validation
```

#### Backend Integration
```typescript
// Endpoint: POST /api/payments/intent
// Stripe API: PaymentIntents.create()
// Database: payments table
// Method: "google_pay"
```

#### Google Pay Flow
```typescript
// 1. Check Google Pay availability
const googlePay = await stripe.googlePay.isAvailable();

// 2. Create payment intent
const paymentIntent = await createPaymentIntent({
  method: "google_pay",
  amount_cents: 5000
});

// 3. Confirm with Google Pay
const result = await stripe.confirmGooglePayPayment(
  paymentIntent.client_secret,
  {
    country: 'US',
    currency: 'usd',
    requiredBillingContactFields: ['email'],
    requiredShippingContactFields: ['email']
  }
);
```

### 4. PayPal (Stripe)

#### Frontend Implementation
```typescript
// Component: PayPalButton
// Library: @stripe/stripe-js
// Element: PayPalButtonElement
// Requirements: PayPal account
// Validation: PayPal validation
```

#### Backend Integration
```typescript
// Endpoint: POST /api/payments/intent
// Stripe API: PaymentIntents.create()
// Database: payments table
// Method: "paypal"
```

#### PayPal Flow
```typescript
// 1. Create payment intent
const paymentIntent = await createPaymentIntent({
  method: "paypal",
  amount_cents: 5000
});

// 2. Confirm with PayPal
const result = await stripe.confirmPayPalPayment(
  paymentIntent.client_secret,
  {
    return_url: 'https://example.com/return'
  }
);
```

### 5. Cash Payments (Backup Authorization)

#### Frontend Implementation
```typescript
// Component: CashPaymentForm
// Library: Custom implementation
// Elements: CardElement for backup
// Validation: Custom validation
// Security: Backup card authorization
```

#### Backend Integration
```typescript
// Endpoint: POST /api/payments/intent
// Stripe API: PaymentIntents.create()
// Database: payments table
// Method: "cash"
// Backup: Card authorization for no-show fees
```

#### Cash Payment Flow
```typescript
// 1. Create payment intent with backup
const paymentIntent = await createPaymentIntent({
  method: "cash",
  amount_cents: 5000,
  backup_setup_intent_id: "setup_intent_id"
});

// 2. Store backup payment method
const setupIntent = await stripe.setupIntents.create({
  customer: customerId,
  payment_method: paymentMethodId,
  usage: 'off_session'
});
```

## Payment Workflows

### 1. Standard Booking Payment

#### Flow Steps
1. **Create Payment Intent**
   - Frontend: `POST /api/payments/intent`
   - Backend: Stripe PaymentIntents.create()
   - Database: Insert payment record

2. **Customer Payment**
   - Frontend: Stripe Elements confirmation
   - Backend: Stripe PaymentIntents.confirm()
   - Database: Update payment status

3. **Webhook Processing**
   - Backend: `POST /api/payments/webhook/stripe`
   - Database: Update payment status
   - Frontend: Real-time status update

#### Frontend Implementation
```typescript
const useBookingPayment = () => {
  const [paymentIntent, setPaymentIntent] = useState(null);
  const [status, setStatus] = useState('idle');

  const createPayment = async (bookingData) => {
    try {
      setStatus('creating');
      const response = await api.post('/api/payments/intent', {
        booking_id: bookingData.id,
        amount_cents: bookingData.amount_cents,
        currency: 'USD',
        customer_id: bookingData.customer_id,
        idempotency_key: generateIdempotencyKey()
      });
      
      setPaymentIntent(response.data);
      setStatus('requires_action');
    } catch (error) {
      setStatus('error');
      throw error;
    }
  };

  const confirmPayment = async (paymentMethodId) => {
    try {
      setStatus('confirming');
      const response = await api.post(
        `/api/payments/intent/${paymentIntent.id}/confirm`,
        { payment_method_id: paymentMethodId }
      );
      
      setStatus('succeeded');
      return response.data;
    } catch (error) {
      setStatus('failed');
      throw error;
    }
  };

  return { paymentIntent, status, createPayment, confirmPayment };
};
```

### 2. Stored Payment Methods

#### Setup Intent Flow
```typescript
// 1. Create setup intent
const setupIntent = await api.post('/api/payments/setup-intent', {
  customer_id: customerId,
  idempotency_key: generateIdempotencyKey()
});

// 2. Confirm setup intent
const result = await stripe.confirmSetupIntent(
  setupIntent.client_secret,
  {
    payment_method: {
      card: cardElement,
      billing_details: {
        name: customerName,
        email: customerEmail
      }
    }
  }
);
```

#### Retrieve Stored Methods
```typescript
// Endpoint: GET /api/payments/methods/{customer_id}
// Response: List of stored payment methods
const storedMethods = await api.get(`/api/payments/methods/${customerId}`);
```

#### Set Default Method
```typescript
// Endpoint: POST /api/payments/methods/{payment_method_id}/default
// Response: Updated payment method
const defaultMethod = await api.post(
  `/api/payments/methods/${paymentMethodId}/default`
);
```

### 3. No-Show Fee Collection

#### Flow Steps
1. **Detect No-Show**
   - Backend: Mark booking as no-show
   - Database: Update booking.no_show_flag

2. **Calculate Fee**
   - Backend: Apply tenant no-show policy
   - Database: Calculate no_show_fee_cents

3. **Capture Fee**
   - Backend: Use stored payment method
   - Database: Create payment record

#### Frontend Implementation
```typescript
const useNoShowFee = () => {
  const captureNoShowFee = async (bookingId) => {
    try {
      const response = await api.post('/api/payments/no-show-fee', {
        booking_id: bookingId,
        idempotency_key: generateIdempotencyKey()
      });
      
      return response.data;
    } catch (error) {
      throw error;
    }
  };

  return { captureNoShowFee };
};
```

### 4. Refund Processing

#### Standard Refund
```typescript
// Endpoint: POST /api/payments/refund
// Payload:
{
  "payment_id": "uuid",
  "amount_cents": 2500, // Partial refund
  "reason": "customer_request",
  "idempotency_key": "unique_key"
}
```

#### Cancellation Refund
```typescript
// Endpoint: POST /api/payments/refund/cancellation
// Payload:
{
  "booking_id": "uuid",
  "refund_amount_cents": 5000,
  "cancellation_policy": "24_hours",
  "idempotency_key": "unique_key"
}
```

## Webhook Handling

### Stripe Webhook Events

#### Required Events
```typescript
const webhookEvents = [
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'payment_intent.canceled',
  'setup_intent.succeeded',
  'setup_intent.setup_failed',
  'charge.dispute.created',
  'charge.dispute.updated',
  'charge.dispute.closed'
];
```

#### Webhook Endpoint
```typescript
// Endpoint: POST /api/payments/webhook/stripe
// Verification: Stripe signature verification
// Processing: Event-specific handlers
// Database: Update payment status
// Frontend: Real-time updates via WebSocket
```

#### Webhook Handler
```typescript
const handleStripeWebhook = async (event) => {
  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentSucceeded(event.data.object);
      break;
    case 'payment_intent.payment_failed':
      await handlePaymentFailed(event.data.object);
      break;
    case 'setup_intent.succeeded':
      await handleSetupSucceeded(event.data.object);
      break;
    case 'charge.dispute.created':
      await handleDisputeCreated(event.data.object);
      break;
    default:
      console.log(`Unhandled event type: ${event.type}`);
  }
};
```

## Error Handling

### Payment Error Types

#### Stripe Errors
```typescript
type StripeError = 
  | 'card_declined'
  | 'insufficient_funds'
  | 'expired_card'
  | 'incorrect_cvc'
  | 'processing_error'
  | 'authentication_required'
  | 'setup_intent_authentication_required';
```

#### Frontend Error Handling
```typescript
const handlePaymentError = (error) => {
  switch (error.code) {
    case 'card_declined':
      return 'Your card was declined. Please try a different card.';
    case 'insufficient_funds':
      return 'Insufficient funds. Please try a different payment method.';
    case 'expired_card':
      return 'Your card has expired. Please use a different card.';
    case 'incorrect_cvc':
      return 'The security code is incorrect. Please check and try again.';
    case 'processing_error':
      return 'A processing error occurred. Please try again.';
    case 'authentication_required':
      return 'Additional authentication required. Please complete the verification.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
};
```

#### Backend Error Handling
```typescript
const handlePaymentError = (error) => {
  if (error.type === 'StripeCardError') {
    return {
      type: 'https://tithi.com/errors/payment',
      title: 'Payment Failed',
      detail: error.message,
      status: 402,
      code: 'TITHI_PAYMENT_STRIPE_ERROR',
      instance: '/api/payments/intent'
    };
  }
  
  return {
    type: 'https://tithi.com/errors/payment',
    title: 'Payment Error',
    detail: 'An unexpected payment error occurred',
    status: 500,
    code: 'TITHI_PAYMENT_ERROR',
    instance: '/api/payments/intent'
  };
};
```

## Idempotency

### Frontend Implementation
```typescript
const generateIdempotencyKey = () => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const useIdempotency = () => {
  const [keys, setKeys] = useState(new Set());
  
  const generateKey = () => {
    const key = generateIdempotencyKey();
    setKeys(prev => new Set([...prev, key]));
    return key;
  };
  
  const isUsed = (key) => keys.has(key);
  
  return { generateKey, isUsed };
};
```

### Backend Implementation
```typescript
// Database constraint: UNIQUE(tenant_id, idempotency_key)
// Middleware: IdempotencyMiddleware
// Cache: Redis for temporary storage
// TTL: 24 hours
```

## Multi-Tenancy

### Stripe Connect
```typescript
// Tenant isolation: Stripe Connect accounts
// Payouts: Tenant-specific payouts
// Webhooks: Tenant-scoped webhook processing
// Metadata: Tenant ID in Stripe objects
```

### Tenant Billing
```typescript
// Database: tenant_billing table
// Stripe: Connect account per tenant
// Payouts: Tenant-specific payout requests
// Fees: Application fees per transaction
```

## Security Considerations

### PCI Compliance
```typescript
// Frontend: Stripe Elements (PCI compliant)
// Backend: No card data storage
// Database: Only payment IDs and metadata
// Security: HTTPS, secure headers
```

### Fraud Prevention
```typescript
// Stripe: Radar fraud detection
// Backend: Rate limiting, IP validation
// Frontend: Input validation, CAPTCHA
// Monitoring: Suspicious activity alerts
```

### Data Protection
```typescript
// Encryption: TLS 1.3
// Storage: Encrypted sensitive data
// Access: Role-based access control
// Audit: Payment audit logs
```

## Testing Strategy

### Unit Tests
```typescript
// Components: Payment form validation
// Hooks: Payment state management
// Utils: Idempotency key generation
// Coverage: 90%+
```

### Integration Tests
```typescript
// API: Payment endpoint testing
// Stripe: Test mode integration
// Database: Payment record validation
// Webhooks: Event processing
```

### E2E Tests
```typescript
// Flows: Complete payment flows
// Scenarios: Success, failure, retry
// Tools: Playwright with Stripe test cards
// Coverage: Critical payment paths
```

## Performance Optimization

### Caching Strategy
```typescript
// Payment Methods: 5 minutes cache
// Customer Data: 10 minutes cache
// Stripe Objects: 1 minute cache
// Cache Keys: tenantId + resource type
```

### Error Recovery
```typescript
// Retry Logic: Exponential backoff
// Fallback: Alternative payment methods
// Graceful Degradation: Cash payment option
// User Experience: Clear error messages
```

## Monitoring and Analytics

### Payment Metrics
```typescript
// Success Rate: Payment success percentage
// Failure Rate: Payment failure percentage
// Average Amount: Mean payment amount
// Processing Time: Payment processing duration
```

### Error Tracking
```typescript
// Sentry: Payment error tracking
// Logs: Detailed payment logs
// Alerts: Payment failure alerts
// Dashboards: Payment analytics
```

---

**Last Updated**: 2024-01-01
**Version**: 1.0.0
**Confidence Score**: 95%
