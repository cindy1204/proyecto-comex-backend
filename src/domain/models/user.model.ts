export const USER_ROLES = ['admin', 'user'] as const;

export type UserRole = (typeof USER_ROLES)[number];

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
}

export interface User extends AuthenticatedUser {
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

export interface NewUser {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
}
