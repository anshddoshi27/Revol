/**
 * useSubdomainValidation Tests
 * 
 * Unit tests for the useSubdomainValidation hook.
 */

import { renderHook, act } from '@testing-library/react';
import { useSubdomainValidation } from '../useSubdomainValidation';

// Mock the onboarding service
jest.mock('../../api/services/onboarding', () => ({
  onboardingService: {
    checkSubdomain: jest.fn(),
  },
  onboardingUtils: {
    validateSubdomain: jest.fn(),
  },
}));

const mockOnboardingService = require('../../api/services/onboarding').onboardingService;
const mockOnboardingUtils = require('../../api/services/onboarding').onboardingUtils;

describe('useSubdomainValidation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('initializes with empty subdomain and no validation state', () => {
    const { result } = renderHook(() => useSubdomainValidation());

    expect(result.current.subdomain).toBe('');
    expect(result.current.isValid).toBe(false);
    expect(result.current.isChecking).toBe(false);
    expect(result.current.isAvailable).toBe(null);
    expect(result.current.error).toBe(null);
  });

  it('validates subdomain format before making API call', () => {
    mockOnboardingUtils.validateSubdomain.mockReturnValue({
      isValid: false,
      error: 'Invalid subdomain format',
    });

    const { result } = renderHook(() => useSubdomainValidation());

    act(() => {
      result.current.setSubdomain('invalid@subdomain');
    });

    act(() => {
      jest.advanceTimersByTime(500); // Trigger debounce
    });

    expect(mockOnboardingUtils.validateSubdomain).toHaveBeenCalledWith('invalid@subdomain');
    expect(result.current.isValid).toBe(false);
    expect(result.current.error).toBe('Invalid subdomain format');
    expect(mockOnboardingService.checkSubdomain).not.toHaveBeenCalled();
  });

  it('makes API call for valid subdomain format', async () => {
    mockOnboardingUtils.validateSubdomain.mockReturnValue({
      isValid: true,
    });

    mockOnboardingService.checkSubdomain.mockResolvedValue({
      subdomain: 'test-subdomain',
      available: true,
      suggested_url: 'test-subdomain.tithi.com',
    });

    const { result } = renderHook(() => useSubdomainValidation());

    act(() => {
      result.current.setSubdomain('test-subdomain');
    });

    act(() => {
      jest.advanceTimersByTime(500); // Trigger debounce
    });

    await act(async () => {
      await Promise.resolve(); // Wait for async operations
    });

    expect(mockOnboardingService.checkSubdomain).toHaveBeenCalledWith('test-subdomain');
    expect(result.current.isValid).toBe(true);
    expect(result.current.isAvailable).toBe(true);
    expect(result.current.suggestion).toBe('test-subdomain.tithi.com');
  });

  it('handles API errors gracefully', async () => {
    mockOnboardingUtils.validateSubdomain.mockReturnValue({
      isValid: true,
    });

    mockOnboardingService.checkSubdomain.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useSubdomainValidation());

    act(() => {
      result.current.setSubdomain('test-subdomain');
    });

    act(() => {
      jest.advanceTimersByTime(500); // Trigger debounce
    });

    await act(async () => {
      await Promise.resolve(); // Wait for async operations
    });

    expect(result.current.error).toBe('Failed to check subdomain availability');
    expect(result.current.isAvailable).toBe(null);
  });

  it('handles unavailable subdomain', async () => {
    mockOnboardingUtils.validateSubdomain.mockReturnValue({
      isValid: true,
    });

    mockOnboardingService.checkSubdomain.mockResolvedValue({
      subdomain: 'taken-subdomain',
      available: false,
    });

    const { result } = renderHook(() => useSubdomainValidation());

    act(() => {
      result.current.setSubdomain('taken-subdomain');
    });

    act(() => {
      jest.advanceTimersByTime(500); // Trigger debounce
    });

    await act(async () => {
      await Promise.resolve(); // Wait for async operations
    });

    expect(result.current.isAvailable).toBe(false);
    expect(result.current.error).toBe('This subdomain is already taken');
  });

  it('debounces validation calls', () => {
    mockOnboardingUtils.validateSubdomain.mockReturnValue({
      isValid: true,
    });

    const { result } = renderHook(() => useSubdomainValidation());

    act(() => {
      result.current.setSubdomain('test');
    });

    act(() => {
      result.current.setSubdomain('test-');
    });

    act(() => {
      result.current.setSubdomain('test-subdomain');
    });

    // Should not have made API call yet
    expect(mockOnboardingService.checkSubdomain).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(500); // Trigger debounce
    });

    // Should have made only one API call for the final value
    expect(mockOnboardingService.checkSubdomain).toHaveBeenCalledTimes(1);
    expect(mockOnboardingService.checkSubdomain).toHaveBeenCalledWith('test-subdomain');
  });

  it('respects minimum length requirement', () => {
    const { result } = renderHook(() => useSubdomainValidation({ minLength: 3 }));

    act(() => {
      result.current.setSubdomain('ab'); // Less than minLength
    });

    act(() => {
      jest.advanceTimersByTime(500); // Trigger debounce
    });

    expect(result.current.isValid).toBe(false);
    expect(result.current.isAvailable).toBe(null);
    expect(mockOnboardingService.checkSubdomain).not.toHaveBeenCalled();
  });

  it('uses custom debounce delay', () => {
    mockOnboardingUtils.validateSubdomain.mockReturnValue({
      isValid: true,
    });

    const { result } = renderHook(() => useSubdomainValidation({ debounceMs: 1000 }));

    act(() => {
      result.current.setSubdomain('test-subdomain');
    });

    act(() => {
      jest.advanceTimersByTime(500); // Half of debounce delay
    });

    expect(mockOnboardingService.checkSubdomain).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(500); // Complete debounce delay
    });

    expect(mockOnboardingService.checkSubdomain).toHaveBeenCalled();
  });

  it('shows checking state during API call', async () => {
    mockOnboardingUtils.validateSubdomain.mockReturnValue({
      isValid: true,
    });

    // Create a promise that we can control
    let resolvePromise: (value: any) => void;
    const promise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    mockOnboardingService.checkSubdomain.mockReturnValue(promise);

    const { result } = renderHook(() => useSubdomainValidation());

    act(() => {
      result.current.setSubdomain('test-subdomain');
    });

    act(() => {
      jest.advanceTimersByTime(500); // Trigger debounce
    });

    // Should be in checking state
    expect(result.current.isChecking).toBe(true);

    // Resolve the promise
    await act(async () => {
      resolvePromise({
        subdomain: 'test-subdomain',
        available: true,
      });
    });

    // Should no longer be checking
    expect(result.current.isChecking).toBe(false);
  });
});