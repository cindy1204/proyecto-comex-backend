import type { UserRoleName } from '../domain/auth.js';

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        role: UserRoleName;
      };
    }
  }
}

export {};
