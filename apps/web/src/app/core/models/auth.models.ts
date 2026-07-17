export type UserRole = 'ADMIN' | 'ANALYST' | 'VIEWER';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  mustChangePassword: boolean;
  user: AuthUser;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}
