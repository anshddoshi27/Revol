/**
 * Simple state management using React Context
 * Stores authentication state and current tenant
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi, tenantsApi, Tenant } from './api-client';

interface AuthState {
  token: string | null;
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    phone?: string;
    created_at?: string;
  } | null;
  currentTenant: Tenant | null;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setCurrentTenant: (tenant: Tenant | null) => void;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AuthState>({
    token: null,
    user: null,
    currentTenant: null,
    isAuthenticated: false,
  });

  // Initialize from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    const userStr = localStorage.getItem('user');
    const tenantStr = localStorage.getItem('current_tenant');
    
    if (token && userStr) {
      const user = JSON.parse(userStr);
      const tenant = tenantStr ? JSON.parse(tenantStr) : null;
      
      setState({
        token,
        user,
        currentTenant: tenant,
        isAuthenticated: true,
      });
    }
  }, []);

  const login = async (email: string, password: string) => {
    const response = await authApi.login({ email, password });
    
    // Backend returns session_token (not access_token)
    localStorage.setItem('auth_token', response.session_token);
    // BACKEND GAP: No refresh_token returned yet
    // localStorage.setItem('refresh_token', response.refresh_token);
    localStorage.setItem('user', JSON.stringify(response.user));
    
    setState({
      token: response.session_token,
      user: {
        id: response.user.id,
        email: response.user.email,
        first_name: response.user.first_name,
        last_name: response.user.last_name,
        phone: response.user.phone,
        created_at: response.user.created_at,
      },
      currentTenant: null,
      isAuthenticated: true,
    });
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('current_tenant_id');
    localStorage.removeItem('current_tenant');
    
    setState({
      token: null,
      user: null,
      currentTenant: null,
      isAuthenticated: false,
    });
  };

  const setCurrentTenant = (tenant: Tenant | null) => {
    if (tenant) {
      localStorage.setItem('current_tenant_id', tenant.id);
      localStorage.setItem('current_tenant', JSON.stringify(tenant));
    } else {
      localStorage.removeItem('current_tenant_id');
      localStorage.removeItem('current_tenant');
    }
    
    setState((prev) => ({
      ...prev,
      currentTenant: tenant,
    }));
  };

  const refreshAuth = async () => {
    try {
      const response = await authApi.refresh();
      localStorage.setItem('auth_token', response.session_token);
      setState((prev) => ({
        ...prev,
        token: response.session_token,
      }));
    } catch (error) {
      // Refresh failed, logout user
      logout();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
        setCurrentTenant,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

