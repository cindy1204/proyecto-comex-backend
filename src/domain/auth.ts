export type UserRoleName = 'admin' | 'user';

export interface AuthenticatedUser {
  id: string;
  role: UserRoleName;
}

export interface UserRecord extends AuthenticatedUser {
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

export interface UserRepository {
  create(user: {
    name: string;
    email: string;
    passwordHash: string;
    role?: UserRoleName;
  }): Promise<UserRecord>;
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  compare(password: string, hash: string): Promise<boolean>;
}

export interface TokenService {
  sign(user: AuthenticatedUser): string;
  verify(token: string): AuthenticatedUser;
}
