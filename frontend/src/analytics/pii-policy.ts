/**
 * PII Policy and Redaction Utilities
 * 
 * This file contains utilities for handling Personally Identifiable Information (PII)
 * in analytics events, including detection, redaction, and compliance validation.
 */

import { ANALYTICS_EVENTS } from './event-schema';

// PII Field Definitions
export const PII_FIELDS = [
  'user_id',
  'customer_id',
  'email',
  'phone',
  'name',
  'address',
  'payment_method',
  'card_number',
  'ssn',
  'date_of_birth',
  'first_name',
  'last_name',
  'full_name',
  'phone_number',
  'email_address',
  'billing_address',
  'shipping_address',
  'ip_address',
  'device_id',
  'session_id', // Note: session_id is considered PII for privacy
] as const;

export type PiiField = typeof PII_FIELDS[number];

// PII Redaction Methods
export enum PiiRedactionMethod {
  HASH = 'hash',
  MASK = 'mask',
  REMOVE = 'remove',
  ANONYMIZE = 'anonymize',
}

// PII Redaction Rules
export const PII_REDACTION_RULES: Record<PiiField, PiiRedactionMethod> = {
  user_id: PiiRedactionMethod.HASH,
  customer_id: PiiRedactionMethod.HASH,
  email: PiiRedactionMethod.HASH,
  phone: PiiRedactionMethod.MASK,
  name: PiiRedactionMethod.HASH,
  address: PiiRedactionMethod.HASH,
  payment_method: PiiRedactionMethod.HASH,
  card_number: PiiRedactionMethod.MASK,
  ssn: PiiRedactionMethod.MASK,
  date_of_birth: PiiRedactionMethod.HASH,
  first_name: PiiRedactionMethod.HASH,
  last_name: PiiRedactionMethod.HASH,
  full_name: PiiRedactionMethod.HASH,
  phone_number: PiiRedactionMethod.MASK,
  email_address: PiiRedactionMethod.HASH,
  billing_address: PiiRedactionMethod.HASH,
  shipping_address: PiiRedactionMethod.HASH,
  ip_address: PiiRedactionMethod.ANONYMIZE,
  device_id: PiiRedactionMethod.HASH,
  session_id: PiiRedactionMethod.HASH,
};

// PII Detection Interface
export interface PiiDetectionResult {
  hasPii: boolean;
  piiFields: string[];
  violations: PiiViolation[];
}

export interface PiiViolation {
  field: string;
  value: any;
  method: PiiRedactionMethod;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// PII Redaction Interface
export interface PiiRedactionResult {
  redactedData: any;
  redactedFields: string[];
  violations: PiiViolation[];
}

// PII Policy Configuration
export interface PiiPolicyConfig {
  enableDetection: boolean;
  enableRedaction: boolean;
  enableValidation: boolean;
  strictMode: boolean;
  logViolations: boolean;
  allowedPiiFields: string[];
  blockedPiiFields: string[];
}

// Default PII Policy Configuration
export const DEFAULT_PII_POLICY: PiiPolicyConfig = {
  enableDetection: true,
  enableRedaction: true,
  enableValidation: true,
  strictMode: true,
  logViolations: true,
  allowedPiiFields: [],
  blockedPiiFields: [...PII_FIELDS],
};

// PII Detection Class
export class PiiDetector {
  private config: PiiPolicyConfig;

  constructor(config: PiiPolicyConfig = DEFAULT_PII_POLICY) {
    this.config = config;
  }

  /**
   * Detect PII fields in an object
   */
  detectPii(data: any, path: string = ''): PiiDetectionResult {
    const piiFields: string[] = [];
    const violations: PiiViolation[] = [];

    if (!this.config.enableDetection) {
      return { hasPii: false, piiFields, violations };
    }

    this._traverseObject(data, path, piiFields, violations);

    return {
      hasPii: piiFields.length > 0,
      piiFields,
      violations,
    };
  }

  /**
   * Check if a field name is considered PII
   */
  isPiiField(fieldName: string): boolean {
    const normalizedField = fieldName.toLowerCase().replace(/[_-]/g, '_');
    return PII_FIELDS.includes(normalizedField as PiiField);
  }

  /**
   * Get the redaction method for a PII field
   */
  getRedactionMethod(fieldName: string): PiiRedactionMethod {
    const normalizedField = fieldName.toLowerCase().replace(/[_-]/g, '_');
    return PII_REDACTION_RULES[normalizedField as PiiField] || PiiRedactionMethod.REMOVE;
  }

  private _traverseObject(
    obj: any,
    path: string,
    piiFields: string[],
    violations: PiiViolation[]
  ): void {
    if (obj === null || obj === undefined) {
      return;
    }

    if (typeof obj === 'object' && !Array.isArray(obj)) {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        
        if (this.isPiiField(key)) {
          piiFields.push(currentPath);
          
          if (this.config.strictMode) {
            violations.push({
              field: currentPath,
              value,
              method: this.getRedactionMethod(key),
              severity: this._getSeverity(key, value),
            });
          }
        }
        
        this._traverseObject(value, currentPath, piiFields, violations);
      }
    } else if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        const currentPath = `${path}[${index}]`;
        this._traverseObject(item, currentPath, piiFields, violations);
      });
    }
  }

  private _getSeverity(fieldName: string, _value: any): 'low' | 'medium' | 'high' | 'critical' {
    const criticalFields = ['ssn', 'card_number', 'payment_method'];
    const highFields = ['email', 'phone', 'address'];
    const mediumFields = ['name', 'user_id', 'customer_id'];
    
    if (criticalFields.includes(fieldName)) {
      return 'critical';
    } else if (highFields.includes(fieldName)) {
      return 'high';
    } else if (mediumFields.includes(fieldName)) {
      return 'medium';
    } else {
      return 'low';
    }
  }
}

// PII Redaction Class
export class PiiRedactor {
  private config: PiiPolicyConfig;
  private detector: PiiDetector;

  constructor(config: PiiPolicyConfig = DEFAULT_PII_POLICY) {
    this.config = config;
    this.detector = new PiiDetector(config);
  }

  /**
   * Redact PII from an object
   */
  redactPii(data: any): PiiRedactionResult {
    const redactedData = this._deepClone(data);
    const redactedFields: string[] = [];
    const violations: PiiViolation[] = [];

    if (!this.config.enableRedaction) {
      return { redactedData, redactedFields, violations };
    }

    this._redactObject(redactedData, '', redactedFields, violations);

    return {
      redactedData,
      redactedFields,
      violations,
    };
  }

  /**
   * Hash a value using a simple hash function
   */
  hashValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    
    const str = String(value);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `hash_${Math.abs(hash).toString(36)}`;
  }

  /**
   * Mask a value (show only first/last characters)
   */
  maskValue(value: any, visibleChars: number = 2): string {
    if (value === null || value === undefined) {
      return '';
    }
    
    const str = String(value);
    if (str.length <= visibleChars * 2) {
      return '*'.repeat(str.length);
    }
    
    const start = str.substring(0, visibleChars);
    const end = str.substring(str.length - visibleChars);
    const middle = '*'.repeat(str.length - visibleChars * 2);
    
    return `${start}${middle}${end}`;
  }

  /**
   * Anonymize an IP address
   */
  anonymizeIp(ip: string): string {
    if (!ip || typeof ip !== 'string') {
      return '';
    }
    
    // IPv4: 192.168.1.1 -> 192.168.1.0
    if (ip.includes('.')) {
      const parts = ip.split('.');
      if (parts.length === 4) {
        parts[3] = '0';
        return parts.join('.');
      }
    }
    
    // IPv6: 2001:db8::1 -> 2001:db8::
    if (ip.includes(':')) {
      const parts = ip.split(':');
      if (parts.length >= 4) {
        parts[parts.length - 1] = '0';
        return parts.join(':');
      }
    }
    
    return ip;
  }

  private _redactObject(
    obj: any,
    path: string,
    redactedFields: string[],
    violations: PiiViolation[]
  ): void {
    if (obj === null || obj === undefined) {
      return;
    }

    if (typeof obj === 'object' && !Array.isArray(obj)) {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        
        if (this.detector.isPiiField(key)) {
          const method = this.detector.getRedactionMethod(key);
          const originalValue = value;
          
          switch (method) {
            case PiiRedactionMethod.HASH:
              obj[key] = this.hashValue(value);
              break;
            case PiiRedactionMethod.MASK:
              obj[key] = this.maskValue(value);
              break;
            case PiiRedactionMethod.REMOVE:
              delete obj[key];
              break;
            case PiiRedactionMethod.ANONYMIZE:
              if (key === 'ip_address') {
                obj[key] = this.anonymizeIp(value as string);
              } else {
                obj[key] = this.hashValue(value);
              }
              break;
          }
          
          redactedFields.push(currentPath);
          
          if (this.config.logViolations) {
            violations.push({
              field: currentPath,
              value: originalValue,
              method,
              severity: this._getSeverity(key, originalValue),
            });
          }
        } else {
          this._redactObject(value, currentPath, redactedFields, violations);
        }
      }
    } else if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        const currentPath = `${path}[${index}]`;
        this._redactObject(item, currentPath, redactedFields, violations);
      });
    }
  }

  private _getSeverity(fieldName: string, _value: any): 'low' | 'medium' | 'high' | 'critical' {
    const criticalFields = ['ssn', 'card_number', 'payment_method'];
    const highFields = ['email', 'phone', 'address'];
    const mediumFields = ['name', 'user_id', 'customer_id'];
    
    if (criticalFields.includes(fieldName)) {
      return 'critical';
    } else if (highFields.includes(fieldName)) {
      return 'high';
    } else if (mediumFields.includes(fieldName)) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  private _deepClone(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (obj instanceof Date) {
      return new Date(obj.getTime());
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this._deepClone(item));
    }
    
    const cloned: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = this._deepClone(obj[key]);
      }
    }
    
    return cloned;
  }
}

// PII Policy Validator
export class PiiPolicyValidator {
  private config: PiiPolicyConfig;
  private detector: PiiDetector;
  private redactor: PiiRedactor;

  constructor(config: PiiPolicyConfig = DEFAULT_PII_POLICY) {
    this.config = config;
    this.detector = new PiiDetector(config);
    this.redactor = new PiiRedactor(config);
  }

  /**
   * Validate that an event complies with PII policy
   */
  validateEvent(_eventName: string, eventData: any): {
    isValid: boolean;
    violations: PiiViolation[];
    redactedData?: any;
  } {
    if (!this.config.enableValidation) {
      return { isValid: true, violations: [] };
    }

    const detection = this.detector.detectPii(eventData);
    const violations = detection.violations;

    if (this.config.strictMode && violations.length > 0) {
      return {
        isValid: false,
        violations,
      };
    }

    // If not in strict mode, redact the data
    const redaction = this.redactor.redactPii(eventData);
    
    return {
      isValid: true,
      violations: [...violations, ...redaction.violations],
      redactedData: redaction.redactedData,
    };
  }

  /**
   * Check if an event is allowed to contain PII
   */
  isPiiAllowed(eventName: string, fieldName: string): boolean {
    // Some events are allowed to contain certain PII fields
    const allowedPiiEvents: Record<string, string[]> = {
      [ANALYTICS_EVENTS.ONBOARDING_STEP_COMPLETE]: ['user_id'],
      [ANALYTICS_EVENTS.ONBOARDING_COMPLETE]: ['user_id'],
      [ANALYTICS_EVENTS.ADMIN_BOOKING_ATTENDED]: ['user_id'],
      [ANALYTICS_EVENTS.ADMIN_BOOKING_NO_SHOW]: ['user_id'],
      [ANALYTICS_EVENTS.ADMIN_BOOKING_CANCELLED]: ['user_id'],
      [ANALYTICS_EVENTS.ADMIN_SERVICE_CREATED]: ['user_id'],
      [ANALYTICS_EVENTS.ADMIN_SERVICE_UPDATED]: ['user_id'],
      [ANALYTICS_EVENTS.ADMIN_AVAILABILITY_UPDATED]: ['user_id'],
      [ANALYTICS_EVENTS.ADMIN_BRANDING_UPDATED]: ['user_id'],
      [ANALYTICS_EVENTS.LOYALTY_POINTS_EARNED]: ['customer_id'],
      [ANALYTICS_EVENTS.LOYALTY_POINTS_REDEEMED]: ['customer_id'],
    };

    const allowedFields = allowedPiiEvents[eventName] || [];
    return allowedFields.includes(fieldName);
  }
}

// Export default instances
export const piiDetector = new PiiDetector();
export const piiRedactor = new PiiRedactor();
export const piiValidator = new PiiPolicyValidator();

// Utility functions
export const detectPii = (data: any): PiiDetectionResult => piiDetector.detectPii(data);
export const redactPii = (data: any): PiiRedactionResult => piiRedactor.redactPii(data);
export const validatePii = (eventName: string, eventData: any) => piiValidator.validateEvent(eventName, eventData);
export const isPiiField = (fieldName: string): boolean => piiDetector.isPiiField(fieldName);
export const getRedactionMethod = (fieldName: string): PiiRedactionMethod => piiDetector.getRedactionMethod(fieldName);
