import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import type { AuthenticatedUser, PasswordHasher, TokenService, UserRoleName } from '../domain/auth.js';
import { ApplicationError } from '../domain/errors.js';
import { config } from './config.js';

export class BcryptPasswordHasher implements PasswordHasher {
  hash(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}

export class JwtTokenService implements TokenService {
  sign(user: AuthenticatedUser): string {
    return jwt.sign(
      { id: user.id, role: user.role },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresInSeconds },
    );
  }

  verify(token: string): AuthenticatedUser {
    try {
      const payload = jwt.verify(token, config.jwtSecret);
      if (typeof payload === 'string') throw this.invalidToken();
      const id = payload.id ?? payload.sub;
      if (typeof id !== 'string' || !id || !isUserRole(payload.role)) {
        throw this.invalidToken();
      }
      return { id, role: payload.role };
    } catch (error) {
      if (error instanceof ApplicationError) throw error;
      if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
        throw this.invalidToken();
      }
      throw error;
    }
  }

  private invalidToken(): ApplicationError {
    return new ApplicationError(401, 'INVALID_TOKEN', 'El token es inválido o expiró.');
  }
}

function isUserRole(role: unknown): role is UserRoleName {
  return role === UserRole.ADMIN.toLowerCase() || role === UserRole.USER.toLowerCase();
}
