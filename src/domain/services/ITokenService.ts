import type { AuthenticatedUser } from '../models/user.model.js';

export interface ITokenService {
  /** Segundos de vigencia de un token firmado. */
  readonly expiresInSeconds: number;
  sign(user: AuthenticatedUser): string;
  /** Devuelve la identidad del token o `null` si es inválido o expiró. */
  verify(token: string): AuthenticatedUser | null;
}
