import { Role } from '@prisma/client';

export type TokenScope = 'full-access' | 'password-change-only';

export interface AuthenticatedUser {
  sub: string;
  email: string;
  role: Role;
  scope: TokenScope;
}
