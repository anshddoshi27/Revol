/**
 * Authentication Context
 * 
 * Provides authentication state and methods throughout the application.
 * Handles JWT tokens, user sessions, and tenant context.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Types
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'customer';
  tenantId?: string;
  businessSlug?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (userData: any) => Promise<void>;
  refreshToken: () => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth provider component
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true
  });

  // Initialize auth state from localStorage
  useEffect(() => {
    const initializeAuth = () => {
      try {
        const token = localStorage.getItem('auth_token');
        const userStr = localStorage.getItem('auth_user');
        
        if (token && userStr) {
          const user = JSON.parse(userStr);
          setAuthState({
            user,
            token,
            isAuthenticated: true,
            isLoading: false
          });
        } else {
          setAuthState(prev => ({ ...prev, isLoading: false }));
        }
      } catch (error) {
        console.error('Failed to initialize auth state:', error);
        setAuthState(prev => ({ ...prev, isLoading: false }));
      }
    };

    initializeAuth();
  }, []);

  // Login function
  const login = async (email: string, password: string): Promise<void> => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));

      // TODO: Replace with actual API call
      // Mock login for now
      const mockUser: User = {
        id: 'dev-user-123',
        email,
        name: email.split('@')[0],
        role: email.includes('admin') ? 'admin' : 'customer',
        tenantId: '550e8400-e29b-41d4-a716-446655440000',
        businessSlug: 'elegant-salon'
      };

      const mockToken = 'mock-jwt-token-' + Date.now();

      // Store in localStorage
      localStorage.setItem('auth_token', mockToken);
      localStorage.setItem('auth_user', JSON.stringify(mockUser));

      setAuthState({
        user: mockUser,
        token: mockToken,
        isAuthenticated: true,
        isLoading: false
      });
    } catch (error) {
      console.error('Login failed:', error);
      setAuthState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  };

  // Logout function
  const logout = (): void => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    
    setAuthState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false
    });
  };

  // Register function
  const register = async (userData: any): Promise<void> => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));

      // TODO: Replace with actual API call
      // Mock registration for now
      const mockUser: User = {
        id: 'dev-user-123',
        email: userData.email,
        name: userData.name,
        role: 'customer',
        tenantId: '550e8400-e29b-41d4-a716-446655440000',
        businessSlug: 'elegant-salon'
      };

      const mockToken = 'mock-jwt-token-' + Date.now();

      // Store in localStorage
      localStorage.setItem('auth_token', mockToken);
      localStorage.setItem('auth_user', JSON.stringify(mockUser));

      setAuthState({
        user: mockUser,
        token: mockToken,
        isAuthenticated: true,
        isLoading: false
      });
    } catch (error) {
      console.error('Registration failed:', error);
      setAuthState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  };

  // Refresh token function
  const refreshToken = async (): Promise<void> => {
    try {
      // TODO: Replace with actual API call
      const newToken = 'refreshed-jwt-token-' + Date.now();
      
      localStorage.setItem('auth_token', newToken);
      
      setAuthState(prev => ({
        ...prev,
        token: newToken
      }));
    } catch (error) {
      console.error('Token refresh failed:', error);
      logout();
    }
  };

  // Update user function
  const updateUser = (userData: Partial<User>): void => {
    if (authState.user) {
      const updatedUser = { ...authState.user, ...userData };
      localStorage.setItem('auth_user', JSON.stringify(updatedUser));
      
      setAuthState(prev => ({
        ...prev,
        user: updatedUser
      }));
    }
  };

  const contextValue: AuthContextType = {
    ...authState,
    login,
    logout,
    register,
    refreshToken,
    updateUser
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// HOC for protected routes
interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: 'admin' | 'customer';
  fallback?: ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requiredRole, 
  fallback = <div>Access denied</div> 
}) => {
  const { isAuthenticated, user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <div>Please log in to access this page</div>;
  }

  if (requiredRole && user.role !== requiredRole) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

// HOC for admin routes
export const AdminRoute: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <ProtectedRoute requiredRole="admin">
      {children}
    </ProtectedRoute>
  );
};

// HOC for customer routes
export const CustomerRoute: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <ProtectedRoute requiredRole="customer">
      {children}
    </ProtectedRoute>
  );
};
