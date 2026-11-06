import type { NewUser, User } from '../models/user.model.js';

export interface IUserRepository {
  create(user: NewUser): Promise<User>;
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
}
