import { UserRole } from '@prisma/client';
import type { UserRecord, UserRepository } from '../domain/auth.js';
import { prisma } from './prisma-client.js';

export class PrismaUserRepository implements UserRepository {
  async create(user: {
    name: string;
    email: string;
    passwordHash: string;
    role?: 'admin' | 'user';
  }): Promise<UserRecord> {
    return this.toUser(await prisma.user.create({
      data: {
        name: user.name,
        email: user.email,
        passwordHash: user.passwordHash,
        role: user.role === 'admin' ? UserRole.ADMIN : UserRole.USER,
      },
    }));
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const user = await prisma.user.findUnique({ where: { email } });
    return user ? this.toUser(user) : null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const user = await prisma.user.findUnique({ where: { id } });
    return user ? this.toUser(user) : null;
  }

  private toUser(user: {
    id: string;
    name: string;
    email: string;
    passwordHash: string;
    role: UserRole;
    createdAt: Date;
  }): UserRecord {
    return { ...user, role: user.role === UserRole.ADMIN ? 'admin' : 'user' };
  }
}
