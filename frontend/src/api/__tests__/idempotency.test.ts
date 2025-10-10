/**
 * Idempotency Utilities Tests
 * 
 * Tests for idempotency key generation, validation, and management.
 */

import {
  generateIdempotencyKey,
  generateIdempotencyKeyWithPrefix,
  generateOperationIdempotencyKey,
  isValidIdempotencyKey,
  extractTimestampFromIdempotencyKey,
  isIdempotencyKeyExpired,
  IDEMPOTENCY_KEY_HEADER,
  IDEMPOTENCY_OPERATIONS,
} from '../idempotency';

describe('Idempotency Utilities', () => {
  describe('generateIdempotencyKey', () => {
    it('should generate a unique key', () => {
      const key1 = generateIdempotencyKey();
      const key2 = generateIdempotencyKey();

      expect(key1).toBeDefined();
      expect(key2).toBeDefined();
      expect(key1).not.toBe(key2);
    });

    it('should generate key with timestamp and random parts', () => {
      const key = generateIdempotencyKey();
      const parts = key.split('-');

      expect(parts.length).toBeGreaterThanOrEqual(2);
      expect(parts[0]).toMatch(/^\d+$/); // Should be timestamp
      expect(parts[1]).toMatch(/^[a-z0-9]+$/); // Should be random string
    });

    it('should generate different keys for different calls', () => {
      const keys = new Set();
      for (let i = 0; i < 100; i++) {
        keys.add(generateIdempotencyKey());
      }
      expect(keys.size).toBe(100);
    });
  });

  describe('generateIdempotencyKeyWithPrefix', () => {
    it('should generate key with custom prefix', () => {
      const prefix = 'test';
      const key = generateIdempotencyKeyWithPrefix(prefix);

      expect(key).toMatch(/^test-\d+-[a-z0-9]+$/);
    });

    it('should generate unique keys with same prefix', () => {
      const prefix = 'test';
      const key1 = generateIdempotencyKeyWithPrefix(prefix);
      const key2 = generateIdempotencyKeyWithPrefix(prefix);

      expect(key1).not.toBe(key2);
      expect(key1).toMatch(/^test-/);
      expect(key2).toMatch(/^test-/);
    });
  });

  describe('generateOperationIdempotencyKey', () => {
    it('should generate key for operation without identifier', () => {
      const operation = 'booking';
      const key = generateOperationIdempotencyKey(operation);

      expect(key).toMatch(/^booking-\d+-[a-z0-9]+$/);
    });

    it('should generate key for operation with identifier', () => {
      const operation = 'booking';
      const identifier = 'user-123';
      const key = generateOperationIdempotencyKey(operation, identifier);

      expect(key).toMatch(/^booking-user-123-\d+-[a-z0-9]+$/);
    });

    it('should generate unique keys for same operation', () => {
      const operation = 'booking';
      const key1 = generateOperationIdempotencyKey(operation);
      const key2 = generateOperationIdempotencyKey(operation);

      expect(key1).not.toBe(key2);
    });
  });

  describe('isValidIdempotencyKey', () => {
    it('should validate correct idempotency key', () => {
      const key = generateIdempotencyKey();
      expect(isValidIdempotencyKey(key)).toBe(true);
    });

    it('should validate key with prefix', () => {
      const key = generateIdempotencyKeyWithPrefix('test');
      expect(isValidIdempotencyKey(key)).toBe(true);
    });

    it('should validate operation key', () => {
      const key = generateOperationIdempotencyKey('booking', 'user-123');
      expect(isValidIdempotencyKey(key)).toBe(true);
    });

    it('should reject empty string', () => {
      expect(isValidIdempotencyKey('')).toBe(false);
    });

    it('should reject null', () => {
      expect(isValidIdempotencyKey(null as any)).toBe(false);
    });

    it('should reject undefined', () => {
      expect(isValidIdempotencyKey(undefined as any)).toBe(false);
    });

    it('should reject non-string values', () => {
      expect(isValidIdempotencyKey(123 as any)).toBe(false);
      expect(isValidIdempotencyKey({} as any)).toBe(false);
      expect(isValidIdempotencyKey([] as any)).toBe(false);
    });

    it('should reject key without dash', () => {
      expect(isValidIdempotencyKey('invalidkey')).toBe(false);
    });

    it('should reject key that is too short', () => {
      expect(isValidIdempotencyKey('a-b')).toBe(false);
    });

    it('should reject key that is too long', () => {
      const longKey = 'a'.repeat(101);
      expect(isValidIdempotencyKey(longKey)).toBe(false);
    });
  });

  describe('extractTimestampFromIdempotencyKey', () => {
    it('should extract timestamp from valid key', () => {
      const timestamp = Date.now();
      const key = `${timestamp}-${Math.random().toString(36).substr(2, 9)}`;
      
      const extracted = extractTimestampFromIdempotencyKey(key);
      expect(extracted).toBe(timestamp);
    });

    it('should extract timestamp from prefixed key', () => {
      const timestamp = Date.now();
      const key = `test-${timestamp}-${Math.random().toString(36).substr(2, 9)}`;
      
      const extracted = extractTimestampFromIdempotencyKey(key);
      expect(extracted).toBe(timestamp);
    });

    it('should extract timestamp from operation key', () => {
      const timestamp = Date.now();
      const key = `booking-user-123-${timestamp}-${Math.random().toString(36).substr(2, 9)}`;
      
      const extracted = extractTimestampFromIdempotencyKey(key);
      expect(extracted).toBe(timestamp);
    });

    it('should return null for invalid key', () => {
      expect(extractTimestampFromIdempotencyKey('invalid')).toBe(null);
      expect(extractTimestampFromIdempotencyKey('')).toBe(null);
      expect(extractTimestampFromIdempotencyKey('a-b')).toBe(null);
    });

    it('should return null for key with non-numeric timestamp', () => {
      const key = 'invalid-timestamp-random';
      expect(extractTimestampFromIdempotencyKey(key)).toBe(null);
    });
  });

  describe('isIdempotencyKeyExpired', () => {
    it('should return false for recent key', () => {
      const key = generateIdempotencyKey();
      expect(isIdempotencyKeyExpired(key)).toBe(false);
    });

    it('should return true for old key', () => {
      const oldTimestamp = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
      const key = `${oldTimestamp}-${Math.random().toString(36).substr(2, 9)}`;
      
      expect(isIdempotencyKeyExpired(key)).toBe(true);
    });

    it('should return true for invalid key', () => {
      expect(isIdempotencyKeyExpired('invalid')).toBe(true);
      expect(isIdempotencyKeyExpired('')).toBe(true);
    });

    it('should respect custom max age', () => {
      const oldTimestamp = Date.now() - (2 * 60 * 60 * 1000); // 2 hours ago
      const key = `${oldTimestamp}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Should not be expired with 24 hour max age
      expect(isIdempotencyKeyExpired(key, 24 * 60 * 60 * 1000)).toBe(false);
      
      // Should be expired with 1 hour max age
      expect(isIdempotencyKeyExpired(key, 60 * 60 * 1000)).toBe(true);
    });
  });

  describe('Constants', () => {
    it('should have correct header name', () => {
      expect(IDEMPOTENCY_KEY_HEADER).toBe('Idempotency-Key');
    });

    it('should have all required operations', () => {
      expect(IDEMPOTENCY_OPERATIONS.BOOKING_CREATE).toBe('booking-create');
      expect(IDEMPOTENCY_OPERATIONS.BOOKING_UPDATE).toBe('booking-update');
      expect(IDEMPOTENCY_OPERATIONS.BOOKING_CANCEL).toBe('booking-cancel');
      expect(IDEMPOTENCY_OPERATIONS.PAYMENT_CREATE).toBe('payment-create');
      expect(IDEMPOTENCY_OPERATIONS.PAYMENT_REFUND).toBe('payment-refund');
      expect(IDEMPOTENCY_OPERATIONS.USER_CREATE).toBe('user-create');
      expect(IDEMPOTENCY_OPERATIONS.USER_UPDATE).toBe('user-update');
      expect(IDEMPOTENCY_OPERATIONS.TENANT_CREATE).toBe('tenant-create');
      expect(IDEMPOTENCY_OPERATIONS.TENANT_UPDATE).toBe('tenant-update');
      expect(IDEMPOTENCY_OPERATIONS.SERVICE_CREATE).toBe('service-create');
      expect(IDEMPOTENCY_OPERATIONS.SERVICE_UPDATE).toBe('service-update');
      expect(IDEMPOTENCY_OPERATIONS.AVAILABILITY_UPDATE).toBe('availability-update');
    });
  });
});
