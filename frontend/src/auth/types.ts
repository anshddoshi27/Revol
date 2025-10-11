/**
 * Authentication Types
 * 
 * Type definitions for authentication-related functionality.
 */

export interface AuthUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  created_at: string;
}

export interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface SignUpFormData {
  email: string;
  password: string;
  phone: string;
  first_name: string;
  last_name: string;
}

export interface LoginFormData {
  email: string;
  password: string;
}

export interface AuthError {
  field?: string;
  message: string;
  code: string;
}
