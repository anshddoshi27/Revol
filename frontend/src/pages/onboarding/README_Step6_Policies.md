# Onboarding Step 6: Booking Policies & Confirmation Message

This directory contains the implementation of Step 6 of the onboarding wizard, which handles booking policies and confirmation message setup for new businesses.

## Overview

Step 6 allows business owners to:
- Create and manage booking policies (cancellation, no-show, refund, cash payment)
- Set up confirmation messages with variable substitution
- Configure checkout warnings and acknowledgments
- Use templates for quick setup

## Components

### Core Components

- **`Step6Policies.tsx`** - Main page component that orchestrates the entire step
- **`PolicyEditor.tsx`** - Policy creation and editing form with template support
- **`ConfirmationMessageEditor.tsx`** - Message editor with quick-paste functionality
- **`CheckoutWarningConfig.tsx`** - Checkout warning configuration

### Hooks

- **`usePolicyManagement.ts`** - Policy management state and operations
- **`useConfirmationMessage.ts`** - Confirmation message management state and operations

### API Services

- **`policiesService`** - Policy CRUD operations
- **`policiesUtils`** - Utility functions for formatting and validation

## Features

### Policy Management
- **CRUD Operations**: Create, read, update, delete policies
- **Template Support**: Pre-built policy templates for quick setup
- **Validation**: Comprehensive form validation with error handling
- **Real-time Preview**: Live preview of policy changes

### Confirmation Message Editor
- **Rich Text Editor**: Full-featured message composition
- **Quick Paste Variables**: Insert dynamic content with one click
- **Template Library**: Pre-built message templates
- **Variable Substitution**: Support for dynamic content like {service_name}, {appointment_date}
- **Preview Functionality**: See how messages will look to customers

### Checkout Warning Configuration
- **Warning Setup**: Configure checkout warnings and acknowledgments
- **Template Support**: Pre-built warning templates
- **Acknowledgment Requirements**: Force customer acknowledgment before checkout
- **Preview Mode**: See how warnings appear during checkout

## API Integration

### Endpoints

- `GET /api/v1/admin/policies/booking` - Get booking policy
- `POST /api/v1/admin/policies/booking` - Create/update booking policy
- `PUT /api/v1/admin/policies/booking/{id}` - Update existing policy
- `DELETE /api/v1/admin/policies/booking/{id}` - Delete policy
- `GET /api/v1/admin/policies/confirmation-message` - Get confirmation message
- `POST /api/v1/admin/policies/confirmation-message` - Create/update message
- `POST /api/v1/admin/policies/confirmation-message/preview` - Preview message

### Data Models

```typescript
interface BookingPolicy {
  id?: string;
  tenant_id: string;
  cancellation_cutoff_hours: number;
  no_show_fee_percent: number;
  no_show_fee_flat_cents?: number;
  refund_policy: string;
  cash_logistics: string;
  is_active: boolean;
}

interface ConfirmationMessage {
  id?: string;
  tenant_id: string;
  content: string;
  is_active: boolean;
}

interface CheckoutWarning {
  id?: string;
  tenant_id: string;
  title: string;
  message: string;
  acknowledgment_required: boolean;
  acknowledgment_text: string;
  is_active: boolean;
}
```

## Templates

### Policy Templates
- **24-Hour Cancellation**: Standard cancellation policy
- **50% No-Show Fee**: No-show fee policy
- **Attendance-Based Refunds**: Refund policy
- **Cash Payment Policy**: Cash payment information

### Confirmation Message Templates
- **Standard Confirmation**: Basic booking confirmation
- **Detailed Confirmation**: Comprehensive confirmation with all details

### Checkout Warning Templates
- **Attendance-Based Charging**: Payment information warning
- **Cancellation Policy**: Policy acknowledgment
- **No-Show Fee**: No-show policy warning

## Quick Paste Variables

### Service Variables
- `{service_name}` - Service name
- `{service_description}` - Service description
- `{service_duration}` - Service duration
- `{service_price}` - Service price
- `{service_instructions}` - Pre-appointment instructions

### Time Variables
- `{appointment_date}` - Appointment date
- `{appointment_time}` - Appointment time
- `{timezone}` - Business timezone

### Business Variables
- `{business_name}` - Business name
- `{business_address}` - Business address
- `{business_phone}` - Business phone
- `{business_email}` - Business email

### Contact Variables
- `{customer_name}` - Customer name

## Validation

### Policy Validation
- Cancellation cutoff: 0-168 hours
- No-show fee: 0-100%
- Flat fee: Non-negative
- Required fields: All policy fields must be filled

### Message Validation
- Content: 10-2000 characters
- Required fields: Content must be provided
- Variable validation: All variables must be valid

### Warning Validation
- Title: 3-100 characters
- Message: 10-500 characters
- Acknowledgment text: 5-200 characters (if required)

## Observability

### Events Tracked
- `onboarding.step6_started` - When step loads
- `onboarding.step6_complete` - When step completes
- `policies.save_success` - When policies are saved
- `policies.save_error` - When policy save fails
- `confirmation_message.save_success` - When message is saved
- `confirmation_message.save_error` - When message save fails
- `checkout.policy_ack_required` - When policy acknowledgment is required
- `checkout.policy_ack_confirmed` - When policy is acknowledged

### Error Handling
- **Validation Errors**: Inline field errors with clear messages
- **Network Errors**: TithiError toast with retry
- **Server Errors**: Generic error toast with support contact
- **Idempotency**: All writes are idempotent with retry-after support

## Performance

### Optimization Features
- **Lazy Loading**: Components loaded on demand
- **Debounced Validation**: Reduced validation calls
- **Memoized Calculations**: Cached computed values
- **Efficient Re-renders**: Optimized component updates

### Performance Targets
- **LCP**: < 2.0s (p75)
- **CLS**: < 0.1 (p75)
- **INP**: < 200ms (p75)
- **Bundle Size**: < 500KB initial

## Testing

### Unit Tests
- Component rendering and interaction tests
- Hook functionality tests
- Validation logic tests
- Utility function tests

### E2E Tests
- Complete onboarding flow
- Policy CRUD operations
- Message CRUD operations
- Template usage
- Form validation
- Navigation between steps

## Accessibility

### WCAG 2.1 AA Compliance
- **Keyboard Navigation**: Full keyboard support
- **Screen Reader Support**: Proper ARIA labels and descriptions
- **Color Contrast**: Meets AA contrast requirements
- **Focus Management**: Clear focus indicators
- **Error Handling**: Accessible error messages

### Form Accessibility
- Required field indicators
- Field descriptions and help text
- Error message association
- Form validation feedback

## Navigation

### Step Flow
1. **Policies Tab**: Create and manage booking policies
2. **Message Tab**: Create and manage confirmation messages
3. **Warning Tab**: Configure checkout warnings
4. **Continue**: Proceed to gift cards configuration

### Data Persistence
- Form data preserved during navigation
- Policies and messages saved to backend
- State synchronized across components
- Auto-save functionality for draft content

## Error Recovery

### User-Friendly Errors
- Clear, actionable error messages
- Field-level validation feedback
- Retry mechanisms for network errors
- Graceful degradation for failed operations

### Error Recovery
- Form state preservation
- Automatic retry for transient errors
- Clear recovery instructions
- Fallback options for failed operations

## Security

### Data Protection
- **PCI Compliance**: No card data in policy forms
- **PII Handling**: Minimal PII collection and proper handling
- **Input Sanitization**: All user inputs are sanitized
- **XSS Prevention**: Proper escaping of dynamic content

### Access Control
- **Tenant Isolation**: All data is tenant-scoped
- **Authentication**: Requires authenticated owner
- **Authorization**: Proper permission checks
- **Audit Trail**: All changes are logged

## Future Enhancements

### Planned Features
- **Rich Text Editor**: WYSIWYG message editing
- **Template Marketplace**: Community-contributed templates
- **A/B Testing**: Template performance testing
- **Analytics**: Message effectiveness tracking
- **Multi-language**: Internationalization support
- **Custom Variables**: User-defined variables
- **Conditional Logic**: Dynamic message content
- **Integration**: Third-party service integration


