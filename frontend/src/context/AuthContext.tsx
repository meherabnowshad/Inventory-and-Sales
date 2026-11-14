import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AuthUser, AuthState, UserRole } from '../types/auth';
import {
  loginApi,
  logoutApi,
  getProfileApi,
  onUnauthorized,
  TOKEN_STORAGE_KEY,
  USER_STORAGE_KEY,
} from '../services/api';

interface AuthContextType extends AuthState {
  login: (usernameOrEmail: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  hasRole: (allowedRoles: UserRole | UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>(() => {
    try {
      const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
      const storedUser = localStorage.getItem(USER_STORAGE_KEY);
      if (storedToken && storedUser) {
        return {
          user: JSON.parse(storedUser) as AuthUser,
          token: storedToken,
          isAuthenticated: true,
          isLoading: false,
        };
      }
    } catch {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(USER_STORAGE_KEY);
    }
    return {
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    };
  });

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } finally {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(USER_STORAGE_KEY);
      setAuthState({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  }, []);

  // IMS-06.2: Listen for 401 unauthorized responses from API client
  useEffect(() => {
    const unsubscribe = onUnauthorized(() => {
      setAuthState({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      });
    });
    return unsubscribe;
  }, []);

  // IMS-05.2 / FR-AUTH-02: Validate active session against backend on page refresh
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (storedToken) {
      getProfileApi().catch(() => {
        // Any 401 triggers response interceptor -> triggerUnauthorized() automatically
      });
    }
  }, []);

  const login = useCallback(
    async (usernameOrEmail: string, password: string): Promise<AuthUser> => {
      setAuthState((prev) => ({ ...prev, isLoading: true }));
      try {
        const response = await loginApi({ usernameOrEmail, password });
        localStorage.setItem(TOKEN_STORAGE_KEY, response.token);
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(response.user));

        setAuthState({
          user: response.user,
          token: response.token,
          isAuthenticated: true,
          isLoading: false,
        });

        return response.user;
      } catch (error) {
        setAuthState((prev) => ({ ...prev, isLoading: false }));
        throw error;
      }
    },
    [],
  );

  const hasRole = useCallback(
    (allowedRoles: UserRole | UserRole[]): boolean => {
      if (!authState.user) return false;
      const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
      return roles.includes(authState.user.role);
    },
    [authState.user],
  );

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        login,
        logout,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
