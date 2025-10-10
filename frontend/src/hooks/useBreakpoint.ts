/**
 * useBreakpoint Hook
 * 
 * A React hook for detecting the current breakpoint and responsive behavior.
 * Provides real-time breakpoint detection and utility functions for responsive design.
 */

import { useState, useEffect, useCallback } from 'react';
import { breakpointValues, getCurrentBreakpoint } from '../styles/tokens';

export type Breakpoint = keyof typeof breakpointValues;

export interface BreakpointState {
  current: Breakpoint;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  width: number;
  height: number;
}

export interface UseBreakpointOptions {
  /**
   * Debounce delay for resize events in milliseconds
   * @default 100
   */
  debounceDelay?: number;
  
  /**
   * Whether to listen to resize events
   * @default true
   */
  listenToResize?: boolean;
  
  /**
   * Initial breakpoint for SSR
   * @default 'lg'
   */
  initialBreakpoint?: Breakpoint;
}

/**
 * Hook for detecting the current breakpoint and responsive behavior
 */
export const useBreakpoint = (options: UseBreakpointOptions = {}): BreakpointState => {
  const {
    debounceDelay = 100,
    listenToResize = true,
    initialBreakpoint = 'lg',
  } = options;

  const [breakpointState, setBreakpointState] = useState<BreakpointState>(() => {
    if (typeof window === 'undefined') {
      // SSR fallback
      return {
        current: initialBreakpoint,
        isMobile: initialBreakpoint === 'xs',
        isTablet: initialBreakpoint === 'sm' || initialBreakpoint === 'md',
        isDesktop: initialBreakpoint === 'lg' || initialBreakpoint === 'xl' || initialBreakpoint === '2xl',
        width: breakpointValues[initialBreakpoint],
        height: 768, // Default height
      };
    }

    const width = window.innerWidth;
    const height = window.innerHeight;
    const current = getCurrentBreakpoint();
    
    return {
      current,
      isMobile: width < breakpointValues.sm,
      isTablet: width >= breakpointValues.sm && width < breakpointValues.lg,
      isDesktop: width >= breakpointValues.lg,
      width,
      height,
    };
  });

  const updateBreakpoint = useCallback(() => {
    if (typeof window === 'undefined') return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const current = getCurrentBreakpoint();
    
    setBreakpointState({
      current,
      isMobile: width < breakpointValues.sm,
      isTablet: width >= breakpointValues.sm && width < breakpointValues.lg,
      isDesktop: width >= breakpointValues.lg,
      width,
      height,
    });
  }, []);

  useEffect(() => {
    if (!listenToResize || typeof window === 'undefined') return;

    let timeoutId: NodeJS.Timeout;

    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(updateBreakpoint, debounceDelay);
    };

    window.addEventListener('resize', handleResize);
    
    // Initial update in case the hook was initialized with SSR
    updateBreakpoint();

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, [updateBreakpoint, debounceDelay, listenToResize]);

  return breakpointState;
};

/**
 * Hook for checking if the current breakpoint matches a specific breakpoint
 */
export const useBreakpointMatch = (breakpoint: Breakpoint): boolean => {
  const { current } = useBreakpoint();
  return current === breakpoint;
};

/**
 * Hook for checking if the current breakpoint is at or above a specific breakpoint
 */
export const useBreakpointUp = (breakpoint: Breakpoint): boolean => {
  const { current } = useBreakpoint();
  return breakpointValues[current] >= breakpointValues[breakpoint];
};

/**
 * Hook for checking if the current breakpoint is at or below a specific breakpoint
 */
export const useBreakpointDown = (breakpoint: Breakpoint): boolean => {
  const { current } = useBreakpoint();
  return breakpointValues[current] <= breakpointValues[breakpoint];
};

/**
 * Hook for checking if the current breakpoint is between two breakpoints
 */
export const useBreakpointBetween = (min: Breakpoint, max: Breakpoint): boolean => {
  const { current } = useBreakpoint();
  const currentValue = breakpointValues[current];
  return currentValue >= breakpointValues[min] && currentValue <= breakpointValues[max];
};

/**
 * Hook for getting responsive values based on breakpoint
 */
export const useResponsiveValue = <T>(values: Partial<Record<Breakpoint, T>>, defaultValue: T): T => {
  const { current } = useBreakpoint();
  
  // Find the closest breakpoint value
  const breakpoints: Breakpoint[] = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'];
  const currentIndex = breakpoints.indexOf(current);
  
  // Look for values from current breakpoint down to xs
  for (let i = currentIndex; i >= 0; i--) {
    const bp = breakpoints[i];
    if (bp && values[bp] !== undefined) {
      return values[bp]!;
    }
  }
  
  return defaultValue;
};

/**
 * Hook for getting responsive array values
 */
export const useResponsiveArray = <T>(values: T[]): T | undefined => {
  const { current } = useBreakpoint();
  const breakpoints: Breakpoint[] = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'];
  const currentIndex = breakpoints.indexOf(current);
  
  // Clamp index to array bounds
  const index = Math.min(currentIndex, values.length - 1);
  return values[index];
};

/**
 * Hook for conditional rendering based on breakpoint
 */
export const useBreakpointRender = (config: {
  mobile?: React.ReactNode;
  tablet?: React.ReactNode;
  desktop?: React.ReactNode;
  fallback?: React.ReactNode;
}): React.ReactNode => {
  const { isMobile, isTablet, isDesktop } = useBreakpoint();
  
  if (isMobile && config.mobile !== undefined) {
    return config.mobile;
  }
  
  if (isTablet && config.tablet !== undefined) {
    return config.tablet;
  }
  
  if (isDesktop && config.desktop !== undefined) {
    return config.desktop;
  }
  
  return config.fallback || null;
};

/**
 * Hook for getting media query strings
 */
export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [query]);

  return matches;
};

/**
 * Hook for getting common media queries
 */
export const useCommonMediaQueries = () => {
  const isMobile = useMediaQuery(`(max-width: ${breakpointValues.sm - 1}px)`);
  const isTablet = useMediaQuery(`(min-width: ${breakpointValues.sm}px) and (max-width: ${breakpointValues.lg - 1}px)`);
  const isDesktop = useMediaQuery(`(min-width: ${breakpointValues.lg}px)`);
  const isLargeDesktop = useMediaQuery(`(min-width: ${breakpointValues.xl}px)`);
  const isExtraLargeDesktop = useMediaQuery(`(min-width: ${breakpointValues['2xl']}px)`);
  
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const prefersHighContrast = useMediaQuery('(prefers-contrast: high)');
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  
  return {
    isMobile,
    isTablet,
    isDesktop,
    isLargeDesktop,
    isExtraLargeDesktop,
    prefersReducedMotion,
    prefersHighContrast,
    prefersDarkMode,
  };
};

// Types are already exported above
