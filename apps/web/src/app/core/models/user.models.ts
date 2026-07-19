import { UserRole } from './auth.models';

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  telegramUsername: string | null;
  invitedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InviteUserRequest {
  email: string;
  name: string;
  role: Exclude<UserRole, 'ADMIN'>;
}

export interface TemporaryPasswordResponse {
  user: Pick<
    AppUser,
    'id' | 'email' | 'name' | 'role' | 'isActive' | 'mustChangePassword' | 'invitedAt' | 'createdAt'
  >;
  temporaryPassword: string;
}

export type InviteUserResponse = TemporaryPasswordResponse;
