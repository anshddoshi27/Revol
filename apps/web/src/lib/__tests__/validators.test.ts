/**
 * Unit tests for data validation schemas
 * Tests Zod schemas for users, businesses, services, customers, bookings
 */

import { describe, it, expect } from 'vitest';
import {
  passwordSchema,
  emailSchema,
  phoneSchema,
  loginSchema,
  signupSchema,
} from '../validators';

describe('Password Validation', () => {
  it('should accept valid password with special character', () => {
    const result = passwordSchema.safeParse('Password123!');
    expect(result.success).toBe(true);
  });

  it('should reject password shorter than 8 characters', () => {
    const result = passwordSchema.safeParse('Pass1!');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toContain('8 characters');
    }
  });

  it('should reject password without special character', () => {
    const result = passwordSchema.safeParse('Password123');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toContain('special character');
    }
  });

  it('should accept password with various special characters', () => {
    const specialChars = ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '-', '_', '+', '='];
    specialChars.forEach(char => {
      const result = passwordSchema.safeParse(`Password123${char}`);
      expect(result.success).toBe(true);
    });
  });
});

describe('Email Validation', () => {
  it('should accept valid email', () => {
    const result = emailSchema.safeParse('test@example.com');
    expect(result.success).toBe(true);
  });

  it('should reject empty email', () => {
    const result = emailSchema.safeParse('');
    expect(result.success).toBe(false);
  });

  it('should reject invalid email format', () => {
    const invalidEmails = [
      'notanemail',
      '@example.com',
      'test@',
      'test@.com',
      'test @example.com',
    ];
    
    invalidEmails.forEach(email => {
      const result = emailSchema.safeParse(email);
      expect(result.success).toBe(false);
    });
  });

  it('should accept email with subdomain', () => {
    const result = emailSchema.safeParse('test@mail.example.com');
    expect(result.success).toBe(true);
  });
});

describe('Phone Validation', () => {
  it('should accept valid phone with country code', () => {
    const result = phoneSchema.safeParse('+1234567890');
    expect(result.success).toBe(true);
  });

  it('should accept phone with formatting', () => {
    const result = phoneSchema.safeParse('(123) 456-7890');
    expect(result.success).toBe(true);
  });

  it('should reject phone shorter than 10 digits', () => {
    const result = phoneSchema.safeParse('123456');
    expect(result.success).toBe(false);
  });

  it('should accept phone without country code', () => {
    const result = phoneSchema.safeParse('1234567890');
    expect(result.success).toBe(true);
  });
});

describe('Login Schema', () => {
  it('should accept valid email login', () => {
    const result = loginSchema.safeParse({
      mode: 'email',
      email: 'test@example.com',
      password: 'Password123!',
    });
    expect(result.success).toBe(true);
  });

  it('should accept valid phone login', () => {
    const result = loginSchema.safeParse({
      mode: 'phone',
      phone: '+1234567890',
      password: 'Password123!',
    });
    expect(result.success).toBe(true);
  });

  it('should reject email login without email', () => {
    const result = loginSchema.safeParse({
      mode: 'email',
      password: 'Password123!',
    });
    expect(result.success).toBe(false);
  });

  it('should reject phone login without phone', () => {
    const result = loginSchema.safeParse({
      mode: 'phone',
      password: 'Password123!',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid password in login', () => {
    const result = loginSchema.safeParse({
      mode: 'email',
      email: 'test@example.com',
      password: 'weak',
    });
    expect(result.success).toBe(false);
  });
});

describe('Signup Schema', () => {
  it('should accept valid signup data', () => {
    const result = signupSchema.safeParse({
      fullName: 'John Doe',
      email: 'john@example.com',
      phone: '+1234567890',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });
    expect(result.success).toBe(true);
  });

  it('should reject signup without first and last name', () => {
    const result = signupSchema.safeParse({
      fullName: 'John',
      email: 'john@example.com',
      phone: '+1234567890',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toContain('first and last name');
    }
  });

  it('should reject signup with mismatched passwords', () => {
    const result = signupSchema.safeParse({
      fullName: 'John Doe',
      email: 'john@example.com',
      phone: '+1234567890',
      password: 'Password123!',
      confirmPassword: 'Different123!',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toContain('match');
    }
  });

  it('should reject invalid email in signup', () => {
    const result = signupSchema.safeParse({
      fullName: 'John Doe',
      email: 'invalid-email',
      phone: '+1234567890',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });
    expect(result.success).toBe(false);
  });
});

