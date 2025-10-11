/**
 * useBreakpoint Hook Tests
 * 
 * Comprehensive tests for the useBreakpoint hook and related utilities.
 */

import { renderHook, act } from '@testing-library/react';
import {
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
} from '../useBreakpoint';
import { breakpointValues } from '../../styles/tokens';

// Mock window.matchMedia
const mockMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
};

// Mock window.innerWidth and innerHeight
const mockWindowSize = (width: number, height: number = 768) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
  
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: height,
  });
};

describe('useBreakpoint', () => {
  beforeEach(() => {
    // Reset window size
    mockWindowSize(1024, 768);
  });

  it('should return correct breakpoint state for desktop', () => {
    mockWindowSize(1024);
    const { result } = renderHook(() => useBreakpoint());
    
    expect(result.current.current).toBe('lg');
    expect(result.current.isMobile).toBe(false);
    expect(result.current.isTablet).toBe(false);
    expect(result.current.isDesktop).toBe(true);
    expect(result.current.width).toBe(1024);
    expect(result.current.height).toBe(768);
  });

  it('should return correct breakpoint state for tablet', () => {
    mockWindowSize(768);
    const { result } = renderHook(() => useBreakpoint());
    
    expect(result.current.current).toBe('md');
    expect(result.current.isMobile).toBe(false);
    expect(result.current.isTablet).toBe(true);
    expect(result.current.isDesktop).toBe(false);
    expect(result.current.width).toBe(768);
  });

  it('should return correct breakpoint state for mobile', () => {
    mockWindowSize(375);
    const { result } = renderHook(() => useBreakpoint());
    
    expect(result.current.current).toBe('xs');
    expect(result.current.isMobile).toBe(true);
    expect(result.current.isTablet).toBe(false);
    expect(result.current.isDesktop).toBe(false);
    expect(result.current.width).toBe(375);
  });

  it('should handle window resize events', () => {
    mockWindowSize(1024);
    const { result } = renderHook(() => useBreakpoint());
    
    expect(result.current.current).toBe('lg');
    
    // Simulate resize to mobile
    act(() => {
      mockWindowSize(375);
      window.dispatchEvent(new Event('resize'));
    });
    
    // Wait for debounce
    act(() => {
      jest.advanceTimersByTime(100);
    });
    
    expect(result.current.current).toBe('xs');
    expect(result.current.isMobile).toBe(true);
  });

  it('should handle SSR with initial breakpoint', () => {
    // Mock SSR environment
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: undefined,
    });
    
    const { result } = renderHook(() => useBreakpoint({ initialBreakpoint: 'md' }));
    
    expect(result.current.current).toBe('md');
    expect(result.current.isTablet).toBe(true);
  });

  it('should respect debounce delay', () => {
    mockWindowSize(1024);
    const { result } = renderHook(() => useBreakpoint({ debounceDelay: 200 }));
    
    expect(result.current.current).toBe('lg');
    
    // Simulate rapid resize events
    act(() => {
      mockWindowSize(375);
      window.dispatchEvent(new Event('resize'));
      mockWindowSize(768);
      window.dispatchEvent(new Event('resize'));
      mockWindowSize(375);
      window.dispatchEvent(new Event('resize'));
    });
    
    // Should not have updated yet
    expect(result.current.current).toBe('lg');
    
    // Wait for debounce
    act(() => {
      jest.advanceTimersByTime(200);
    });
    
    expect(result.current.current).toBe('xs');
  });

  it('should not listen to resize when disabled', () => {
    mockWindowSize(1024);
    const { result } = renderHook(() => useBreakpoint({ listenToResize: false }));
    
    expect(result.current.current).toBe('lg');
    
    // Simulate resize
    act(() => {
      mockWindowSize(375);
      window.dispatchEvent(new Event('resize'));
    });
    
    // Should not have updated
    expect(result.current.current).toBe('lg');
  });
});

describe('useBreakpointMatch', () => {
  it('should return true when breakpoint matches', () => {
    mockWindowSize(1024);
    const { result } = renderHook(() => useBreakpointMatch('lg'));
    expect(result.current).toBe(true);
  });

  it('should return false when breakpoint does not match', () => {
    mockWindowSize(1024);
    const { result } = renderHook(() => useBreakpointMatch('md'));
    expect(result.current).toBe(false);
  });
});

describe('useBreakpointUp', () => {
  it('should return true when current breakpoint is above target', () => {
    mockWindowSize(1024);
    const { result } = renderHook(() => useBreakpointUp('md'));
    expect(result.current).toBe(true);
  });

  it('should return true when current breakpoint equals target', () => {
    mockWindowSize(1024);
    const { result } = renderHook(() => useBreakpointUp('lg'));
    expect(result.current).toBe(true);
  });

  it('should return false when current breakpoint is below target', () => {
    mockWindowSize(1024);
    const { result } = renderHook(() => useBreakpointUp('xl'));
    expect(result.current).toBe(false);
  });
});

describe('useBreakpointDown', () => {
  it('should return true when current breakpoint is below target', () => {
    mockWindowSize(1024);
    const { result } = renderHook(() => useBreakpointDown('xl'));
    expect(result.current).toBe(true);
  });

  it('should return true when current breakpoint equals target', () => {
    mockWindowSize(1024);
    const { result } = renderHook(() => useBreakpointDown('lg'));
    expect(result.current).toBe(true);
  });

  it('should return false when current breakpoint is above target', () => {
    mockWindowSize(1024);
    const { result } = renderHook(() => useBreakpointDown('md'));
    expect(result.current).toBe(false);
  });
});

describe('useBreakpointBetween', () => {
  it('should return true when current breakpoint is between min and max', () => {
    mockWindowSize(1024);
    const { result } = renderHook(() => useBreakpointBetween('md', 'xl'));
    expect(result.current).toBe(true);
  });

  it('should return true when current breakpoint equals min', () => {
    mockWindowSize(1024);
    const { result } = renderHook(() => useBreakpointBetween('lg', 'xl'));
    expect(result.current).toBe(true);
  });

  it('should return true when current breakpoint equals max', () => {
    mockWindowSize(1024);
    const { result } = renderHook(() => useBreakpointBetween('md', 'lg'));
    expect(result.current).toBe(true);
  });

  it('should return false when current breakpoint is below min', () => {
    mockWindowSize(1024);
    const { result } = renderHook(() => useBreakpointBetween('xl', '2xl'));
    expect(result.current).toBe(false);
  });

  it('should return false when current breakpoint is above max', () => {
    mockWindowSize(1024);
    const { result } = renderHook(() => useBreakpointBetween('xs', 'md'));
    expect(result.current).toBe(false);
  });
});

describe('useResponsiveValue', () => {
  it('should return value for current breakpoint', () => {
    mockWindowSize(1024);
    const values = { lg: 'large', md: 'medium', sm: 'small' };
    const { result } = renderHook(() => useResponsiveValue(values, 'default'));
    expect(result.current).toBe('large');
  });

  it('should return value for closest smaller breakpoint', () => {
    mockWindowSize(1024);
    const values = { md: 'medium', sm: 'small' };
    const { result } = renderHook(() => useResponsiveValue(values, 'default'));
    expect(result.current).toBe('medium');
  });

  it('should return default value when no match found', () => {
    mockWindowSize(1024);
    const values = { sm: 'small' };
    const { result } = renderHook(() => useResponsiveValue(values, 'default'));
    expect(result.current).toBe('default');
  });
});

describe('useResponsiveArray', () => {
  it('should return value at correct index', () => {
    mockWindowSize(1024); // lg breakpoint (index 3)
    const values = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'];
    const { result } = renderHook(() => useResponsiveArray(values));
    expect(result.current).toBe('lg');
  });

  it('should clamp to array bounds', () => {
    mockWindowSize(320); // xs breakpoint (index 0)
    const values = ['small', 'medium'];
    const { result } = renderHook(() => useResponsiveArray(values));
    expect(result.current).toBe('small');
  });
});

describe('useBreakpointRender', () => {
  it('should render mobile content on mobile', () => {
    mockWindowSize(375);
    const config = {
      mobile: React.createElement('div', null, 'Mobile'),
      tablet: React.createElement('div', null, 'Tablet'),
      desktop: React.createElement('div', null, 'Desktop'),
    };
    const { result } = renderHook(() => useBreakpointRender(config));
    expect(result.current).toEqual(React.createElement('div', null, 'Mobile'));
  });

  it('should render tablet content on tablet', () => {
    mockWindowSize(768);
    const config = {
      mobile: React.createElement('div', null, 'Mobile'),
      tablet: React.createElement('div', null, 'Tablet'),
      desktop: React.createElement('div', null, 'Desktop'),
    };
    const { result } = renderHook(() => useBreakpointRender(config));
    expect(result.current).toEqual(React.createElement('div', null, 'Tablet'));
  });

  it('should render desktop content on desktop', () => {
    mockWindowSize(1024);
    const config = {
      mobile: React.createElement('div', null, 'Mobile'),
      tablet: React.createElement('div', null, 'Tablet'),
      desktop: React.createElement('div', null, 'Desktop'),
    };
    const { result } = renderHook(() => useBreakpointRender(config));
    expect(result.current).toEqual(React.createElement('div', null, 'Desktop'));
  });

  it('should render fallback when no match', () => {
    mockWindowSize(1024);
    const config = {
      mobile: React.createElement('div', null, 'Mobile'),
      fallback: React.createElement('div', null, 'Fallback'),
    };
    const { result } = renderHook(() => useBreakpointRender(config));
    expect(result.current).toEqual(React.createElement('div', null, 'Fallback'));
  });
});

describe('useMediaQuery', () => {
  it('should return true when media query matches', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useMediaQuery('(max-width: 768px)'));
    expect(result.current).toBe(true);
  });

  it('should return false when media query does not match', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery('(max-width: 768px)'));
    expect(result.current).toBe(false);
  });

  it('should update when media query changes', () => {
    const mockMediaQuery = {
      matches: false,
      media: '(max-width: 768px)',
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    };

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(() => mockMediaQuery),
    });

    const { result } = renderHook(() => useMediaQuery('(max-width: 768px)'));
    expect(result.current).toBe(false);

    // Simulate media query change
    act(() => {
      mockMediaQuery.matches = true;
      mockMediaQuery.addEventListener.mock.calls[0][1]({ matches: true });
    });

    expect(result.current).toBe(true);
  });
});

describe('useCommonMediaQueries', () => {
  beforeEach(() => {
    mockMatchMedia(false);
  });

  it('should return correct media query states', () => {
    const { result } = renderHook(() => useCommonMediaQueries());
    
    expect(result.current.isMobile).toBe(false);
    expect(result.current.isTablet).toBe(false);
    expect(result.current.isDesktop).toBe(false);
    expect(result.current.isLargeDesktop).toBe(false);
    expect(result.current.isExtraLargeDesktop).toBe(false);
    expect(result.current.prefersReducedMotion).toBe(false);
    expect(result.current.prefersHighContrast).toBe(false);
    expect(result.current.prefersDarkMode).toBe(false);
  });

  it('should handle multiple media queries', () => {
    // Mock different responses for different queries
    const mockMediaQuery = jest.fn().mockImplementation(query => ({
      matches: query.includes('max-width: 639px'), // Mobile query
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: mockMediaQuery,
    });

    const { result } = renderHook(() => useCommonMediaQueries());
    
    expect(result.current.isMobile).toBe(true);
    expect(result.current.isTablet).toBe(false);
    expect(result.current.isDesktop).toBe(false);
  });
});
