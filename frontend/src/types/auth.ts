export type UserRole = 'Administrator' | 'Sales Staff' | 'Store Staff';

export interface AuthUser {
  id: string | number;
  name: string;
  username: string;
  email: string;
  role: UserRole;
}

export interface LoginCredentials {
  usernameOrEmail: string;
  password: string;
}

export interface AuthResponse {
  user: AuthUser;
  token: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
