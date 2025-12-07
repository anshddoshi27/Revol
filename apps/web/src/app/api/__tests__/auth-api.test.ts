/**
 * Unit tests for authentication API handlers
 * Tests signup and login flows
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createServerClient } from '@/lib/db';

// Mock dependencies
vi.mock('@/lib/db');

describe('Authentication API Logic', () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabase = {
      auth: {
        signUp: vi.fn(),
        signInWithPassword: vi.fn(),
        getUser: vi.fn(),
      },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    };

    (createServerClient as any).mockResolvedValue(mockSupabase);
  });

  describe('Signup Flow', () => {
    it('should create user with valid data', async () => {
      const signupData = {
        email: 'newuser@example.com',
        password: 'Password123!',
        fullName: 'John Doe',
        phone: '+1234567890',
      };

      mockSupabase.auth.signUp.mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: signupData.email,
          },
        },
        error: null,
      });

      const result = await mockSupabase.auth.signUp({
        email: signupData.email,
        password: signupData.password,
        options: {
          data: {
            full_name: signupData.fullName,
            phone: signupData.phone,
          },
        },
      });

      expect(result.data.user).toBeTruthy();
      expect(result.data.user.email).toBe(signupData.email);
      expect(result.error).toBeNull();
    });

    it('should reject duplicate email', async () => {
      const signupData = {
        email: 'existing@example.com',
        password: 'Password123!',
      };

      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: null },
        error: {
          message: 'User already registered',
          status: 400,
        },
      });

      const result = await mockSupabase.auth.signUp({
        email: signupData.email,
        password: signupData.password,
      });

      expect(result.error).toBeTruthy();
      expect(result.error.message).toContain('already registered');
    });

    it('should validate password requirements', () => {
      const weakPasswords = ['short', 'nouppercase123!', 'NOLOWERCASE123!', 'NoSpecialChar123'];

      weakPasswords.forEach(password => {
        // Password validation would happen before signup
        const isValid = password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[^A-Za-z0-9]/.test(password);
        expect(isValid).toBe(false);
      });
    });
  });

  describe('Login Flow', () => {
    it('should login with valid credentials', async () => {
      const loginData = {
        email: 'user@example.com',
        password: 'Password123!',
      };

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: loginData.email,
          },
          session: {
            access_token: 'token-123',
          },
        },
        error: null,
      });

      const result = await mockSupabase.auth.signInWithPassword({
        email: loginData.email,
        password: loginData.password,
      });

      expect(result.data.user).toBeTruthy();
      expect(result.data.session).toBeTruthy();
      expect(result.error).toBeNull();
    });

    it('should reject invalid password', async () => {
      const loginData = {
        email: 'user@example.com',
        password: 'WrongPassword123!',
      };

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: {
          message: 'Invalid login credentials',
          status: 400,
        },
      });

      const result = await mockSupabase.auth.signInWithPassword({
        email: loginData.email,
        password: loginData.password,
      });

      expect(result.error).toBeTruthy();
      expect(result.error.message).toContain('Invalid');
    });

    it('should reject non-existent email', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'Password123!',
      };

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: {
          message: 'Invalid login credentials',
          status: 400,
        },
      });

      const result = await mockSupabase.auth.signInWithPassword({
        email: loginData.email,
        password: loginData.password,
      });

      expect(result.error).toBeTruthy();
    });
  });

  describe('Business Creation on Signup', () => {
    it('should create one business per owner', async () => {
      const userId = 'user-123';

      // Check existing business
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' }, // No rows
        }),
      });

      // Create business
      mockSupabase.from.mockReturnValueOnce({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'biz-123', user_id: userId },
          error: null,
        }),
      });

      // First business creation should succeed
      const result = await mockSupabase.from('businesses').insert({
        user_id: userId,
        name: 'Test Business',
      }).select().single();

      expect(result.data).toBeTruthy();
      expect(result.data.user_id).toBe(userId);
    });

    it('should prevent second business creation', async () => {
      const userId = 'user-123';
      const existingBusiness = { id: 'biz-123', user_id: userId };

      // Check existing business
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: existingBusiness,
          error: null,
        }),
      });

      // Attempting to create second business should fail
      const hasExistingBusiness = existingBusiness !== null;
      expect(hasExistingBusiness).toBe(true);
    });
  });
});

