# Tithi Frontend

This directory contains the frontend implementation for the Tithi platform, including design tokens, analytics, and responsive utilities.

## Directory Structure

```
frontend/
├── docs/                          # Frontend documentation
│   ├── analytics-events.json      # Analytics event taxonomy
│   └── responsive.md              # Responsive design guidelines
├── src/                           # Source code
│   ├── analytics/                 # Analytics system
│   │   ├── __tests__/            # Analytics tests
│   │   ├── analytics-service.ts   # Main analytics service
│   │   ├── event-schema.ts        # Event type definitions
│   │   ├── index.ts              # Analytics module exports
│   │   ├── pii-policy.ts         # PII handling utilities
│   │   └── README.md             # Analytics documentation
│   ├── hooks/                     # React hooks
│   │   ├── __tests__/            # Hook tests
│   │   └── useBreakpoint.ts      # Breakpoint detection hook
│   └── styles/                    # Design system
│       ├── __tests__/            # Style tests
│       └── tokens.ts             # Design tokens
└── tailwind.config.ts            # Tailwind CSS configuration
```

## Features

### Design System (`src/styles/`)
- **Breakpoints**: XS/SM/MD/LG/XL/2XL responsive breakpoints
- **Typography**: Inter font family with consistent scale
- **Colors**: Status colors, neutral grays, and tenant-specific primary colors
- **Spacing**: 4px base unit system
- **Accessibility**: WCAG 2.1 AA compliant utilities

### Analytics System (`src/analytics/`)
- **Event Taxonomy**: 40+ events covering all critical user journeys
- **PII Compliance**: Automatic detection and redaction of personally identifiable information
- **Schema Validation**: Strong typing and runtime validation
- **Sampling**: Environment-specific sampling rates
- **Privacy First**: GDPR/CCPA compliant with configurable retention

### Responsive Utilities (`src/hooks/`)
- **Breakpoint Detection**: Real-time breakpoint detection with React hooks
- **Responsive Values**: Utilities for responsive design patterns
- **Media Queries**: Common media query hooks
- **SSR Support**: Server-side rendering compatibility

## Quick Start

### Design Tokens
```typescript
import { breakpoints, typography, colors } from './src/styles/tokens';

// Use breakpoints
const isMobile = window.innerWidth < breakpoints.sm;

// Use typography
const headingStyle = typography.fontSize['2xl'];

// Use colors
const primaryColor = colors.primary[500];
```

### Analytics
```typescript
import { emitEvent, setTenantContext } from './src/analytics';

// Set context
setTenantContext('my-business');

// Emit events
await emitEvent('onboarding.step_complete', {
  step: 'business_info',
  tenant_id: 'my-business',
  user_id: 'user-123',
  step_duration_ms: 5000,
  previous_step: 'welcome',
});
```

### Responsive Design
```typescript
import { useBreakpoint, useResponsiveValue } from './src/hooks/useBreakpoint';

function ResponsiveComponent() {
  const { isMobile, isTablet, isDesktop } = useBreakpoint();
  const padding = useResponsiveValue({
    xs: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  }, 'p-4');

  return (
    <div className={`${padding} ${isMobile ? 'text-sm' : 'text-base'}`}>
      Responsive content
    </div>
  );
}
```

## Development

### Prerequisites
- Node.js 18+
- npm or yarn
- TypeScript

### Installation
```bash
cd frontend
npm install
```

### Testing
```bash
# Run all tests
npm test

# Run analytics tests
npm run test:analytics

# Run design token tests
npm run test:tokens

# Run hook tests
npm run test:hooks
```

### Building
```bash
# Build for production
npm run build

# Build with type checking
npm run build:check
```

## Configuration

### Tailwind CSS
The `tailwind.config.ts` file extends Tailwind CSS with custom design tokens:
- Custom breakpoints
- Typography scale
- Color system
- Spacing system
- Accessibility utilities

### Analytics
Configure analytics in your app initialization:
```typescript
import { analyticsService } from './src/analytics';

// Configure analytics
analyticsService.setTenantContext('my-business');
analyticsService.setUserContext('user-123');
```

## Documentation

- [Responsive Design Guidelines](./docs/responsive.md)
- [Analytics Event Taxonomy](./docs/analytics-events.json)
- [Analytics System Documentation](./src/analytics/README.md)

## Contributing

When adding new features:

1. **Design Tokens**: Add new tokens to `src/styles/tokens.ts`
2. **Analytics**: Add new events to `docs/analytics-events.json`
3. **Hooks**: Add new hooks to `src/hooks/`
4. **Tests**: Add tests for all new functionality
5. **Documentation**: Update relevant documentation

## License

This frontend code is part of the Tithi platform and follows the same licensing terms.
