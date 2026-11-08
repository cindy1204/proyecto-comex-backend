import bcrypt from 'bcryptjs';
import type { IPasswordHasher } from '../../domain/services/IPasswordHasher.js';

export class BcryptPasswordHasher implements IPasswordHasher {
  constructor(private readonly rounds = 12) {}

  hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.rounds);
  }

  compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
