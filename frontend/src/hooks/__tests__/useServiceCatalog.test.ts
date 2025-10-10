/**
 * useServiceCatalog Hook Tests
 * 
 * Unit tests for the useServiceCatalog hook.
 */

import { renderHook, act } from '@testing-library/react';
import { useServiceCatalog } from '../useServiceCatalog';
import type { ServiceData, ServiceFormData } from '../../api/types/services';

// Mock the services API
jest.mock('../../api/services/services', () => ({
  servicesService: {
    createService: jest.fn(),
    updateService: jest.fn(),
    deleteService: jest.fn(),
  },
  servicesUtils: {
    formatPrice: jest.fn((cents) => `$${(cents / 100).toFixed(2)}`),
    formatDuration: jest.fn((minutes) => `${minutes} min`),
    generateServiceSlug: jest.fn((name) => name.toLowerCase().replace(/\s+/g, '-')),
  },
}));

describe('useServiceCatalog', () => {
  const mockOnServiceCreated = jest.fn();
  const mockOnServiceUpdated = jest.fn();
  const mockOnServiceDeleted = jest.fn();
  const mockOnError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initializes with empty services array', () => {
    const { result } = renderHook(() => useServiceCatalog());

    expect(result.current.services).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.errors).toEqual({});
    expect(result.current.validationErrors).toEqual([]);
  });

  it('initializes with provided services', () => {
    const initialServices: ServiceData[] = [
      {
        id: '1',
        name: 'Test Service',
        description: 'Test description',
        duration_minutes: 60,
        price_cents: 5000,
        special_requests_enabled: false,
        quick_chips: [],
      },
    ];

    const { result } = renderHook(() => 
      useServiceCatalog({ initialServices })
    );

    expect(result.current.services).toEqual(initialServices);
  });

  it('validates service data correctly', () => {
    const { result } = renderHook(() => useServiceCatalog());

    const invalidData: Partial<ServiceFormData> = {
      name: 'A', // Too short
      description: 'Short', // Too short
      duration_minutes: 5, // Too short
      price_cents: -100, // Negative
    };

    const errors = result.current.validateService(invalidData);

    expect(errors).toHaveLength(4);
    expect(errors[0].field).toBe('name');
    expect(errors[1].field).toBe('description');
    expect(errors[2].field).toBe('duration_minutes');
    expect(errors[3].field).toBe('price_cents');
  });

  it('formats price correctly', () => {
    const { result } = renderHook(() => useServiceCatalog());

    expect(result.current.formatPrice(5000)).toBe('$50.00');
    expect(result.current.formatPrice(1000)).toBe('$10.00');
  });

  it('formats duration correctly', () => {
    const { result } = renderHook(() => useServiceCatalog());

    expect(result.current.formatDuration(60)).toBe('60 min');
    expect(result.current.formatDuration(90)).toBe('90 min');
  });

  it('generates slug correctly', () => {
    const { result } = renderHook(() => useServiceCatalog());

    expect(result.current.generateSlug('Test Service')).toBe('test-service');
    expect(result.current.generateSlug('Hair Cut & Style')).toBe('hair-cut-&-style');
  });

  it('calculates computed values correctly', () => {
    const services: ServiceData[] = [
      {
        id: '1',
        name: 'Service 1',
        description: 'Description 1',
        duration_minutes: 60,
        price_cents: 5000,
        special_requests_enabled: false,
        quick_chips: [],
        active: true,
      },
      {
        id: '2',
        name: 'Service 2',
        description: 'Description 2',
        duration_minutes: 90,
        price_cents: 7500,
        special_requests_enabled: true,
        quick_chips: ['Option 1'],
        active: false,
      },
    ];

    const { result } = renderHook(() => 
      useServiceCatalog({ initialServices: services })
    );

    expect(result.current.totalServices).toBe(2);
    expect(result.current.activeServices).toBe(1);
    expect(result.current.servicesByCategory).toEqual({
      'Uncategorized': services,
    });
  });

  it('groups services by category correctly', () => {
    const services: ServiceData[] = [
      {
        id: '1',
        name: 'Service 1',
        description: 'Description 1',
        duration_minutes: 60,
        price_cents: 5000,
        special_requests_enabled: false,
        quick_chips: [],
        category: 'Hair',
      },
      {
        id: '2',
        name: 'Service 2',
        description: 'Description 2',
        duration_minutes: 90,
        price_cents: 7500,
        special_requests_enabled: false,
        quick_chips: [],
        category: 'Hair',
      },
      {
        id: '3',
        name: 'Service 3',
        description: 'Description 3',
        duration_minutes: 120,
        price_cents: 10000,
        special_requests_enabled: false,
        quick_chips: [],
        category: 'Massage',
      },
    ];

    const { result } = renderHook(() => 
      useServiceCatalog({ initialServices: services })
    );

    expect(result.current.servicesByCategory).toEqual({
      'Hair': [services[0], services[1]],
      'Massage': [services[2]],
    });
  });

  it('clears errors when clearErrors is called', () => {
    const { result } = renderHook(() => useServiceCatalog());

    act(() => {
      result.current.setError('test', 'Test error');
    });

    expect(result.current.errors).toEqual({ test: 'Test error' });

    act(() => {
      result.current.clearErrors();
    });

    expect(result.current.errors).toEqual({});
    expect(result.current.validationErrors).toEqual([]);
  });

  it('gets service by ID correctly', () => {
    const services: ServiceData[] = [
      {
        id: '1',
        name: 'Service 1',
        description: 'Description 1',
        duration_minutes: 60,
        price_cents: 5000,
        special_requests_enabled: false,
        quick_chips: [],
      },
      {
        id: '2',
        name: 'Service 2',
        description: 'Description 2',
        duration_minutes: 90,
        price_cents: 7500,
        special_requests_enabled: false,
        quick_chips: [],
      },
    ];

    const { result } = renderHook(() => 
      useServiceCatalog({ initialServices: services })
    );

    expect(result.current.getService('1')).toEqual(services[0]);
    expect(result.current.getService('2')).toEqual(services[1]);
    expect(result.current.getService('3')).toBeUndefined();
  });
});
