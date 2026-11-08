import jwt from 'jsonwebtoken';
import { USER_ROLES, type AuthenticatedUser, type UserRole } from '../../domain/models/user.model.js';
import type { ITokenService } from '../../domain/services/ITokenService.js';

export class JwtTokenService implements ITokenService {
  constructor(
    private readonly secret: string,
    readonly expiresInSeconds: number,
  ) {}

  sign(user: AuthenticatedUser): string {
    return jwt.sign({ role: user.role }, this.secret, {
      subject: user.id,
      expiresIn: this.expiresInSeconds,
      algorithm: 'HS256',
    });
  }

  verify(token: string): AuthenticatedUser | null {
    try {
      const payload = jwt.verify(token, this.secret, { algorithms: ['HS256'] });
      if (typeof payload === 'string' || !payload.sub || !isUserRole(payload.role)) return null;
      return { id: payload.sub, role: payload.role };
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) return null;
      throw error;
    }
  }
}

function isUserRole(role: unknown): role is UserRole {
  return USER_ROLES.some((candidate) => candidate === role);
}
