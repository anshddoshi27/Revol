# Onboarding Step 8 - Payments, Wallets & Subscription (GO LIVE)

## Overview

Step 8 is the final step of the onboarding wizard, completing the business setup with payment configuration, KYC verification, and go-live functionality. This step ensures businesses can accept payments and are fully compliant before going live.

## Components

### 1. PaymentSetup Component
- **Purpose**: Handles Stripe setup intent creation and confirmation
- **Features**:
  - Stripe Elements integration for secure card collection
  - Subscription consent checkboxes ($11.99/month)
  - Terms of service and privacy policy agreements
  - Real-time validation and error handling
  - Analytics tracking for payment events

### 2. WalletToggles Component
- **Purpose**: Configures supported payment methods
- **Features**:
  - Toggle switches for Cards, Apple Pay, Google Pay, PayPal, Cash
  - Cash payment policy enforcement (requires card on file)
  - Real-time payment method summary
  - Validation to ensure cards are always enabled
  - Analytics tracking for wallet configuration changes

### 3. KYCForm Component
- **Purpose**: Collects business verification information
- **Features**:
  - Business information (legal name, DBA, business type, tax ID)
  - Representative details (name, email, phone)
  - Business address collection
  - Payout destination configuration (bank account or card)
  - Statement descriptor and tax display settings
  - Comprehensive form validation
  - Analytics tracking for form interactions

### 4. GoLiveModal Component
- **Purpose**: Final confirmation before going live
- **Features**:
  - Important information about going live
  - Final consent checkboxes
  - Confirmation that business is ready
  - Analytics tracking for go-live events

### 5. GoLiveSuccess Component
- **Purpose**: Celebration screen after successful go-live
- **Features**:
  - Animated success celebration
  - Booking site and admin dashboard links
  - Copy-to-clipboard functionality
  - Next steps guidance
  - Analytics tracking for success events

## Hooks

### 1. usePaymentSetup Hook
- **Purpose**: Manages payment setup state and operations
- **Features**:
  - Stripe setup intent creation and confirmation
  - Wallet configuration management
  - KYC data creation and updates
  - Go-live functionality
  - Payment setup validation
  - Error handling and loading states

### 2. useKYCForm Hook
- **Purpose**: Manages KYC form state and validation
- **Features**:
  - Form field management
  - Real-time validation
  - Address and payout destination handling
  - Error state management
  - Analytics tracking

## API Integration

### Payment Service
- **Setup Intent**: Creates and confirms Stripe setup intents
- **Wallet Config**: Updates supported payment methods
- **KYC Management**: Creates and updates business verification data
- **Go Live**: Processes go-live requests
- **Validation**: Validates payment setup completeness

### Endpoints Used
- `POST /api/v1/admin/payments/setup-intent` - Create setup intent
- `POST /api/v1/admin/payments/setup-intent/{id}/confirm` - Confirm setup intent
- `PUT /api/v1/admin/payments/wallets/{tenant_id}` - Update wallet config
- `POST /api/v1/admin/payments/kyc/{tenant_id}` - Create KYC data
- `PUT /api/v1/admin/payments/kyc/{tenant_id}` - Update KYC data
- `POST /api/v1/admin/payments/go-live/{tenant_id}` - Go live
- `GET /api/v1/admin/payments/validate/{tenant_id}` - Validate setup

## Data Flow

1. **Payment Setup**: User sets up Stripe payment method for subscription
2. **Wallet Configuration**: User selects supported payment methods
3. **KYC Verification**: User provides business verification information
4. **Go Live Confirmation**: User confirms they want to go live
5. **Success Screen**: Business is live with booking and admin links

## Validation Rules

### Payment Setup
- Subscription consent required
- Terms of service agreement required
- Privacy policy agreement required
- Stripe setup intent must succeed

### Wallet Configuration
- Cards must always be enabled
- Cash payments require cards to be enabled
- At least one payment method must be selected

### KYC Form
- Legal business name required
- Representative name, email, and phone required
- Valid email format required
- Valid phone format required
- Complete business address required
- Account holder name required
- Bank account details required (if bank account selected)
- Statement descriptor required (5-22 characters, alphanumeric)

### Go Live
- All previous steps must be completed
- All consent checkboxes must be checked
- Final confirmation required

## Error Handling

- **Payment Errors**: Clear error messages for Stripe failures
- **Validation Errors**: Inline field validation with helpful messages
- **Network Errors**: Retry mechanisms with exponential backoff
- **Server Errors**: Generic error messages with support contact
- **Analytics**: All errors are tracked for monitoring

## Analytics Events

### Payment Events
- `payments.setup_intent_started` - Setup intent creation started
- `payments.setup_intent_created` - Setup intent created successfully
- `payments.setup_intent_succeeded` - Setup intent confirmed
- `payments.setup_intent_failed` - Setup intent failed

### Wallet Events
- `wallets.toggle_update` - Wallet toggle changed
- `wallets.config_updated` - Wallet configuration saved

### KYC Events
- `kyc.field_updated` - Form field updated
- `kyc.address_field_updated` - Address field updated
- `kyc.payout_field_updated` - Payout field updated
- `kyc.payout_type_changed` - Payout type changed
- `kyc.form_validated` - Form validation completed
- `kyc.created` - KYC data created
- `kyc.updated` - KYC data updated

### Go Live Events
- `owner.go_live_confirmed` - Go live confirmed
- `owner.go_live_success` - Business went live successfully
- `owner.link_copied` - Link copied to clipboard
- `owner.admin_dashboard_accessed` - Admin dashboard accessed
- `owner.booking_site_viewed` - Booking site viewed

### Onboarding Events
- `onboarding.step8_started` - Step 8 started
- `onboarding.step8_payment_complete` - Payment setup completed
- `onboarding.step8_wallets_complete` - Wallet configuration completed
- `onboarding.step8_kyc_complete` - KYC verification completed
- `onboarding.step8_complete` - Step 8 completed

## Testing

### Unit Tests
- Component rendering and interaction tests
- Form validation tests
- Error handling tests
- Analytics event tracking tests

### E2E Tests
- Complete payment setup flow
- Wallet configuration flow
- KYC form completion
- Go-live process
- Success screen functionality
- Error handling scenarios

## Performance Requirements

- **LCP**: < 2.0s for payment setup UI
- **Network**: < 600ms median to Stripe
- **Bundle**: < 500KB initial
- **Main Thread**: No long tasks > 200ms

## Security Considerations

- **PCI Compliance**: No raw card data stored in frontend
- **Stripe Elements**: Secure card collection
- **HTTPS**: All API calls over secure connections
- **PII Protection**: Sensitive data handling in KYC form
- **Idempotency**: All mutations use idempotency keys

## Accessibility

- **WCAG 2.1 AA**: Full compliance
- **Keyboard Navigation**: All interactions keyboard accessible
- **Screen Readers**: Proper ARIA labels and descriptions
- **Focus Management**: Clear focus indicators
- **Error Announcements**: Screen reader accessible error messages

## Mobile Responsiveness

- **Mobile-First**: Designed for mobile devices
- **Touch Targets**: Minimum 44px touch targets
- **Responsive Layout**: Adapts to all screen sizes
- **One-Handed Use**: Critical interactions reachable one-handed

## Future Enhancements

1. **3DS Support**: Enhanced authentication for international cards
2. **Multiple Currencies**: Support for non-USD currencies
3. **Advanced KYC**: Additional verification requirements
4. **Payment Analytics**: Detailed payment method performance
5. **A/B Testing**: Payment flow optimization
6. **Offline Support**: Offline payment setup with sync
7. **Multi-Language**: Internationalization support
8. **Advanced Validation**: Real-time business verification

## Dependencies

- **Stripe**: Payment processing
- **React Hook Form**: Form management
- **Tailwind CSS**: Styling
- **React Router**: Navigation
- **Axios**: API client
- **Playwright**: E2E testing
- **Jest**: Unit testing

## Related Files

- `/src/pages/onboarding/Step8Payments.tsx` - Main page component
- `/src/components/onboarding/PaymentSetup.tsx` - Payment setup component
- `/src/components/onboarding/WalletToggles.tsx` - Wallet configuration component
- `/src/components/onboarding/KYCForm.tsx` - KYC form component
- `/src/components/onboarding/GoLiveModal.tsx` - Go-live modal component
- `/src/components/onboarding/GoLiveSuccess.tsx` - Success screen component
- `/src/hooks/usePaymentSetup.ts` - Payment setup hook
- `/src/hooks/useKYCForm.ts` - KYC form hook
- `/src/api/services/payments.ts` - Payment API service
- `/src/api/types/payments.ts` - Payment type definitions

