/**
 * Authentication Service
 * 
 * Service for handling authentication operations including signup, login, and token management.
 */

import { apiClient } from '../api/client';
import { setTokenProvider } from '../lib/env';

// Temporary types until backend integration
interface SignUpRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
}

interface SignUpResponse {
  user_id: string;
  session_token: string;
  user: AuthUser;
  onboarding_prefill: any;
}

interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  user_id: string;
  session_token: string;
  user: AuthUser;
}
import { AuthUser, AuthError } from './types';

// Backend authentication API
const auth = {
  signUp: async (data: SignUpRequest): Promise<SignUpResponse> => {
    const response = await apiClient.post('/auth/signup', data);
    return response.data;
  },
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await apiClient.post('/auth/login', data);
    return response.data;
  }
};

// Token provider is now properly imported from lib/env

class AuthService {
  private token: string | null = null;
  private user: AuthUser | null = null;

  constructor() {
    // Initialize token provider for API client
    setTokenProvider(() => this.token);
    
    // Load token from localStorage on initialization
    this.loadTokenFromStorage();
  }

  /**
   * Sign up a new user
   */
  async signup(formData: SignUpRequest): Promise<{ user: AuthUser; token: string; onboardingPrefill: any }> {
    try {
      const response: SignUpResponse = await auth.signUp(formData);
      
      // Store token and user data
      this.token = response.session_token;
      this.user = response.user;
      
      // Persist to localStorage
      this.saveTokenToStorage();
      
      return {
        user: response.user,
        token: response.session_token,
        onboardingPrefill: response.onboarding_prefill
      };
    } catch (error: any) {
      throw this.normalizeAuthError(error);
    }
  }

  /**
   * Login an existing user
   */
  async login(formData: LoginRequest): Promise<{ user: AuthUser; token: string }> {
    try {
      const response: LoginResponse = await auth.login(formData);
      
      // Store token and user data
      this.token = response.session_token;
      this.user = response.user;
      
      // Persist to localStorage
      this.saveTokenToStorage();
      
      return {
        user: response.user,
        token: response.session_token
      };
    } catch (error: any) {
      throw this.normalizeAuthError(error);
    }
  }

  /**
   * Logout current user
   */
  async logout(): Promise<void> {
    try {
      if (this.token) {
        // Logout handled locally
      }
    } catch (error) {
      // Continue with logout even if API call fails
      console.warn('Logout API call failed:', error);
    } finally {
      // Clear local state
      this.token = null;
      this.user = null;
      this.clearTokenFromStorage();
    }
  }

  /**
   * Get current user
   */
  getCurrentUser(): AuthUser | null {
    return this.user;
  }

  /**
   * Get current token
   */
  getCurrentToken(): string | null {
    return this.token;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.token !== null && this.user !== null;
  }

  /**
   * Save token to localStorage
   */
  private saveTokenToStorage(): void {
    if (this.token) {
      localStorage.setItem('auth_token', this.token);
      localStorage.setItem('auth_user', JSON.stringify(this.user));
    }
  }

  /**
   * Load token from localStorage
   */
  private loadTokenFromStorage(): void {
    const token = localStorage.getItem('auth_token');
    const userStr = localStorage.getItem('auth_user');
    if (token && userStr) {
      this.token = token;
      try {
        this.user = JSON.parse(userStr);
      } catch (error) {
        console.error('Failed to parse user data:', error);
        this.clearTokenFromStorage();
      }
    }
  }

  /**
   * Clear token from localStorage
   */
  private clearTokenFromStorage(): void {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
  }

  /**
   * Normalize API errors to AuthError format
   */
  private normalizeAuthError(error: any): AuthError {
    if (error.response?.data) {
      const errorData = error.response.data;
      return {
        field: errorData.field || undefined,
        message: errorData.message || errorData.detail || 'Authentication failed',
        code: errorData.code || errorData.error_code || 'AUTH_ERROR'
      };
    }
    
    return {
      message: error.message || 'Authentication failed',
      code: 'AUTH_ERROR'
    };
  }
}

// Export singleton instance
export const authService = new AuthService();
