/**
 * Idempotency Utilities
 * 
 * Provides idempotency key generation and management for API requests.
 * Ensures that duplicate operations are handled safely.
 */

/**
 * Generates a unique idempotency key
 * @returns Unique idempotency key string
 */
export const generateIdempotencyKey = (): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  return `${timestamp}-${random}`;
};

/**
 * Generates an idempotency key with a custom prefix
 * @param prefix - Custom prefix for the key
 * @returns Unique idempotency key with prefix
 */
export const generateIdempotencyKeyWithPrefix = (prefix: string): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  return `${prefix}-${timestamp}-${random}`;
};

/**
 * Generates an idempotency key for a specific operation
 * @param operation - Operation type (e.g., 'booking', 'payment')
 * @param identifier - Optional identifier (e.g., user ID, tenant ID)
 * @returns Unique idempotency key for the operation
 */
export const generateOperationIdempotencyKey = (
  operation: string,
  identifier?: string
): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  const idPart = identifier ? `-${identifier}` : '';
  return `${operation}${idPart}-${timestamp}-${random}`;
};

/**
 * Validates an idempotency key format
 * @param key - Idempotency key to validate
 * @returns True if the key is valid
 */
export const isValidIdempotencyKey = (key: string): boolean => {
  // Basic validation: should be non-empty and contain timestamp and random parts
  if (!key || typeof key !== 'string') {
    return false;
  }
  
  // Should contain at least one dash (separating parts)
  if (!key.includes('-')) {
    return false;
  }
  
  // Should be reasonable length (not too short or too long)
  if (key.length < 10 || key.length > 100) {
    return false;
  }
  
  return true;
};

/**
 * Extracts timestamp from an idempotency key
 * @param key - Idempotency key
 * @returns Timestamp or null if invalid
 */
export const extractTimestampFromIdempotencyKey = (key: string): number | null => {
  if (!isValidIdempotencyKey(key)) {
    return null;
  }
  
  const parts = key.split('-');
  if (parts.length < 2) {
    return null;
  }
  
  // For keys with prefix (e.g., "test-1234567890-abc"), timestamp is in the second part
  // For keys without prefix (e.g., "1234567890-abc"), timestamp is in the first part
  // For operation keys (e.g., "booking-user-123-1234567890-abc"), timestamp is in the 4th part
  let timestampPart: string;
  if (parts.length >= 4) {
    // Operation key: operation-identifier-timestamp-random
    timestampPart = parts[parts.length - 2] || '0'; // Second to last part
  } else if (parts.length >= 3) {
    // Prefixed key: prefix-timestamp-random
    timestampPart = parts[1] || '0';
  } else {
    // Simple key: timestamp-random
    timestampPart = parts[0] || '0';
  }
  
  const timestamp = parseInt(timestampPart, 10);
  if (isNaN(timestamp) || timestamp <= 0) {
    return null;
  }
  
  return timestamp;
};

/**
 * Checks if an idempotency key is expired
 * @param key - Idempotency key
 * @param maxAgeMs - Maximum age in milliseconds (default: 24 hours)
 * @returns True if the key is expired
 */
export const isIdempotencyKeyExpired = (
  key: string,
  maxAgeMs: number = 24 * 60 * 60 * 1000 // 24 hours
): boolean => {
  const timestamp = extractTimestampFromIdempotencyKey(key);
  if (timestamp === null) {
    return true; // Invalid keys are considered expired
  }
  
  const now = Date.now();
  return (now - timestamp) > maxAgeMs;
};

/**
 * Idempotency key header name
 */
export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';

/**
 * Common operation types for idempotency keys
 */
export const IDEMPOTENCY_OPERATIONS = {
  BOOKING_CREATE: 'booking-create',
  BOOKING_UPDATE: 'booking-update',
  BOOKING_CANCEL: 'booking-cancel',
  PAYMENT_CREATE: 'payment-create',
  PAYMENT_REFUND: 'payment-refund',
  USER_CREATE: 'user-create',
  USER_UPDATE: 'user-update',
  TENANT_CREATE: 'tenant-create',
  TENANT_UPDATE: 'tenant-update',
  SERVICE_CREATE: 'service-create',
  SERVICE_UPDATE: 'service-update',
  AVAILABILITY_UPDATE: 'availability-update',
} as const;

export type IdempotencyOperation = typeof IDEMPOTENCY_OPERATIONS[keyof typeof IDEMPOTENCY_OPERATIONS];
