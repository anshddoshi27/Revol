"use client";

import * as React from "react";

interface FakeUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
}

interface FakeSessionState {
  isAuthenticated: boolean;
  user?: FakeUser;
}

interface FakeSessionContextValue extends FakeSessionState {
  login: (user: FakeUser) => void;
  logout: () => void;
  devLogin: () => void;
}

const defaultState: FakeSessionState = {
  isAuthenticated: false
};

const FakeSessionContext = React.createContext<FakeSessionContextValue | undefined>(
  undefined
);

export function FakeSessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<FakeSessionState>(defaultState);

  const login = React.useCallback((user: FakeUser) => {
    setSession({ isAuthenticated: true, user });
  }, []);

  const logout = React.useCallback(() => {
    setSession(defaultState);
  }, []);

  const devLogin = React.useCallback(() => {
    login({
      id: "dev-user",
      name: "Dev Owner",
      email: "owner@tithi.dev",
      phone: "+1 (555) 010-0011"
    });
  }, [login]);

  const value = React.useMemo(
    () => ({
      ...session,
      login,
      logout,
      devLogin
    }),
    [session, login, logout, devLogin]
  );

  return <FakeSessionContext.Provider value={value}>{children}</FakeSessionContext.Provider>;
}

export function useFakeSession() {
  const context = React.useContext(FakeSessionContext);
  if (!context) {
    throw new Error("useFakeSession must be used within a FakeSessionProvider");
  }
  return context;
}



