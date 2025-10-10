/**
 * Tithi Frontend
 * 
 * Main entry point for the Tithi frontend library.
 * Exports all public APIs for design tokens, analytics, and responsive utilities.
 */

// Design System
export * from './styles/tokens';

// Analytics System
export * from './analytics';

// Responsive Utilities
export * from './hooks/useBreakpoint';

// Authentication
export * from './auth';

// Components
export * from './components';

// Pages
export * from './pages';

// Re-export commonly used items
export {
  // Design tokens
  breakpoints,
  typography,
  spacing,
  colors,
  borderRadius,
  boxShadow,
  zIndex,
  animation,
  layout,
  accessibility,
  
  // Utility functions
  getBreakpointValue,
  isMobile,
  isTablet,
  isDesktop,
  getCurrentBreakpoint,
  applyTenantTheme,
} from './styles/tokens';

export {
  // Analytics
  analyticsService,
  emitEvent,
  setTenantContext,
  setUserContext,
  piiDetector,
  piiRedactor,
  piiValidator,
  detectPii,
  redactPii,
  validatePii,
  isPiiField,
  getRedactionMethod,
  
  // PII Policy
  PII_FIELDS,
  DEFAULT_PII_POLICY,
  
  // Event Schema
  ANALYTICS_EVENTS,
} from './analytics';

export {
  // Breakpoint hooks
  useBreakpoint,
  useBreakpointMatch,
  useBreakpointUp,
  useBreakpointDown,
  useBreakpointBetween,
  useResponsiveValue,
  useResponsiveArray,
  useBreakpointRender,
  useMediaQuery,
  useCommonMediaQueries,
  
  // Types
  type Breakpoint,
  type BreakpointState,
  type UseBreakpointOptions,
} from './hooks/useBreakpoint';

// Version information
export const VERSION = '1.0.0';
export const BUILD_DATE = new Date().toISOString();
