/**
 * AuthService Tests
 * 
 * Unit tests for the authentication service.
 */

import { authService } from '../authService';
import { auth } from '../../../../docs/frontend/frontend-context-pack/all_context_pack';

// Mock the context pack
jest.mock('../../../../docs/frontend/frontend-context-pack/all_context_pack', () => ({
  auth: {
    signup: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
  },
  setTokenProvider: jest.fn(),
}));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  describe('signup', () => {
    it('should successfully sign up a new user', async () => {
      const mockResponse = {
        user_id: 'user-123',
        session_token: 'token-123',
        user: {
          id: 'user-123',
          email: 'test@example.com',
          first_name: 'John',
          last_name: 'Doe',
          phone: '+1234567890',
          created_at: '2024-01-01T00:00:00Z',
        },
        onboarding_prefill: {
          owner_email: 'test@example.com',
          owner_name: 'John Doe',
          phone: '+1234567890',
        },
      };

      (auth.signup as jest.Mock).mockResolvedValue(mockResponse);

      const formData = {
        email: 'test@example.com',
        password: 'password123',
        phone: '+1234567890',
        first_name: 'John',
        last_name: 'Doe',
      };

      const result = await authService.signup(formData);

      expect(auth.signup).toHaveBeenCalledWith(formData);
      expect(result.user).toEqual(mockResponse.user);
      expect(result.token).toBe(mockResponse.session_token);
      expect(result.onboardingPrefill).toEqual(mockResponse.onboarding_prefill);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('tithi_auth_token', 'token-123');
    });

    it('should handle signup errors', async () => {
      const mockError = {
        response: {
          data: {
            code: 'TITHI_DUPLICATE_EMAIL_ERROR',
            message: 'Email already exists',
          },
        },
      };

      (auth.signup as jest.Mock).mockRejectedValue(mockError);

      const formData = {
        email: 'test@example.com',
        password: 'password123',
        phone: '+1234567890',
        first_name: 'John',
        last_name: 'Doe',
      };

      await expect(authService.signup(formData)).rejects.toEqual({
        field: undefined,
        message: 'Email already exists',
        code: 'TITHI_DUPLICATE_EMAIL_ERROR',
      });
    });
  });

  describe('login', () => {
    it('should successfully login a user', async () => {
      const mockResponse = {
        user_id: 'user-123',
        session_token: 'token-123',
        user: {
          id: 'user-123',
          email: 'test@example.com',
          first_name: 'John',
          last_name: 'Doe',
          phone: '+1234567890',
          created_at: '2024-01-01T00:00:00Z',
        },
      };

      (auth.login as jest.Mock).mockResolvedValue(mockResponse);

      const formData = {
        email: 'test@example.com',
        password: 'password123',
      };

      const result = await authService.login(formData);

      expect(auth.login).toHaveBeenCalledWith(formData);
      expect(result.user).toEqual(mockResponse.user);
      expect(result.token).toBe(mockResponse.session_token);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('tithi_auth_token', 'token-123');
    });
  });

  describe('logout', () => {
    it('should successfully logout a user', async () => {
      (auth.logout as jest.Mock).mockResolvedValue(undefined);

      await authService.logout();

      expect(auth.logout).toHaveBeenCalled();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('tithi_auth_token');
    });

    it('should clear local state even if API call fails', async () => {
      (auth.logout as jest.Mock).mockRejectedValue(new Error('API Error'));

      await authService.logout();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('tithi_auth_token');
    });
  });

  describe('isAuthenticated', () => {
    it('should return false when no token is present', () => {
      expect(authService.isAuthenticated()).toBe(false);
    });

    it('should return true when token is present', () => {
      authService['token'] = 'test-token';
      authService['user'] = { id: 'user-123', email: 'test@example.com' } as any;
      
      expect(authService.isAuthenticated()).toBe(true);
    });
  });
});
