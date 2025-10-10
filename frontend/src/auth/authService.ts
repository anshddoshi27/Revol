/**
 * Authentication Service
 * 
 * Service for handling authentication operations including signup, login, and token management.
 */

// TODO: Import from actual backend API when available
// import { auth, SignUpRequest, SignUpResponse, LoginRequest, LoginResponse } from '../api';
// import { setTokenProvider } from '../api';

// Temporary types until backend integration
interface SignUpRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
}

interface SignUpResponse {
  user: AuthUser;
  token: string;
}

interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  user: AuthUser;
  token: string;
}
import { AuthUser, AuthError } from './types';

// Temporary auth function until backend integration
const auth = {
  signUp: async (_data: SignUpRequest): Promise<SignUpResponse> => {
    // Mock implementation
    throw new Error('Backend integration not yet implemented');
  },
  login: async (_data: LoginRequest): Promise<LoginResponse> => {
    // Mock implementation
    throw new Error('Backend integration not yet implemented');
  }
};

// Temporary setTokenProvider function
const setTokenProvider = (provider: () => string | null) => {
  // Mock implementation
  console.log('setTokenProvider called with:', provider);
};

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
      this.token = response.token;
      this.user = response.user;
      
      // Persist to localStorage
      this.saveTokenToStorage();
      
      return {
        user: response.user,
        token: response.token,
        onboardingPrefill: {}
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
      this.token = response.token;
      this.user = response.user;
      
      // Persist to localStorage
      this.saveTokenToStorage();
      
      return {
        user: response.user,
        token: response.token
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
      localStorage.setItem('tithi_auth_token', this.token);
    }
  }

  /**
   * Load token from localStorage
   */
  private loadTokenFromStorage(): void {
    const token = localStorage.getItem('tithi_auth_token');
    if (token) {
      this.token = token;
      // Note: In a real app, you might want to validate the token here
      // For now, we'll assume it's valid if it exists
    }
  }

  /**
   * Clear token from localStorage
   */
  private clearTokenFromStorage(): void {
    localStorage.removeItem('tithi_auth_token');
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
