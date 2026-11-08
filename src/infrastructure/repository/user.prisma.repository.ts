import { UserRole as PrismaUserRole, type PrismaClient, type User as UserRow } from '@prisma/client';
import type { NewUser, User, UserRole } from '../../domain/models/user.model.js';
import type { IUserRepository } from '../../domain/repository/IUser.repository.js';

const ROLE_TO_DB: Record<UserRole, PrismaUserRole> = {
  admin: PrismaUserRole.ADMIN,
  user: PrismaUserRole.USER,
};

function toDomain(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.passwordHash,
    role: row.role === PrismaUserRole.ADMIN ? 'admin' : 'user',
    createdAt: row.createdAt,
  };
}

export class UserPrismaRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(user: NewUser): Promise<User> {
    const row = await this.prisma.user.create({
      data: {
        name: user.name,
        email: user.email,
        passwordHash: user.passwordHash,
        role: ROLE_TO_DB[user.role],
      },
    });
    return toDomain(row);
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { email } });
    return row ? toDomain(row) : null;
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }
}
