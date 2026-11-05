import { ApplicationError } from '../domain/errors.js';
import type {
  AuthenticatedUser,
  PasswordHasher,
  TokenService,
  UserRepository,
  UserRoleName,
} from '../domain/auth.js';

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly passwords: PasswordHasher,
    private readonly tokens: TokenService,
  ) {}

  async register(input: { name: string; email: string; password: string }) {
    const user = await this.users.create({
      name: input.name,
      email: input.email,
      passwordHash: await this.passwords.hash(input.password),
    });
    return this.toPublicUser(user);
  }

  async registerAdmin(input: { name: string; email: string; password: string }) {
    const user = await this.users.create({
      name: input.name,
      email: input.email,
      passwordHash: await this.passwords.hash(input.password),
      role: 'admin',
    });
    return this.toPublicUser(user);
  }

  async login(input: { email: string; password: string }) {
    const user = await this.users.findByEmail(input.email);
    const passwordMatches = user
      ? await this.passwords.compare(input.password, user.passwordHash)
      : false;
    if (!user || !passwordMatches) {
      throw new ApplicationError(401, 'INVALID_CREDENTIALS', 'Correo o contraseña incorrectos.');
    }

    const identity = { id: user.id, role: user.role };
    return { token: this.tokens.sign(identity), user: this.toPublicUser(user) };
  }

  authenticate(token: string): AuthenticatedUser {
    const identity = this.tokens.verify(token);
    return identity;
  }

  async getCurrentUser(id: string) {
    const user = await this.users.findById(id);
    if (!user) throw new ApplicationError(404, 'NOT_FOUND', 'El usuario no existe.');
    return this.toPublicUser(user);
  }

  private toPublicUser(user: {
    id: string;
    name: string;
    email: string;
    role: UserRoleName;
    createdAt: Date;
  }) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    };
  }
}
