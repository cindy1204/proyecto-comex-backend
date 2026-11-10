import type { AuthenticatedUser, NewUser, User } from '../../domain/models/user.model.js';
import type { IUserRepository } from '../../domain/repository/IUser.repository.js';
import type { IPasswordHasher } from '../../domain/services/IPasswordHasher.js';
import type { ITokenService } from '../../domain/services/ITokenService.js';
import { ConflictError } from '../errors/conflict.error.js';
import { NotFoundError } from '../errors/not-found.error.js';
import { UnauthorizedError } from '../errors/unauthorized.error.js';
import { toPublicUser, type PublicUser } from '../mappers/user.mapper.js';

export interface Credentials {
  email: string;
  password: string;
}

export interface Registration extends Credentials {
  name: string;
}

export interface Session {
  user: PublicUser;
  token: string;
  expiresIn: number;
}

/**
 * Hash bcrypt (coste 12, igual que el real) de un texto aleatorio descartado; no es un secreto.
 * Se compara cuando el correo no existe para que el login tarde lo mismo que con un usuario real
 * y no revele por tiempo qué correos están registrados.
 */
const DUMMY_PASSWORD_HASH = '$2b$12$gCLDeZOrrm88PY6UM/agvewPQn8PScLzAF1aCN6bkIz5V6Etbt6ti';

export class AuthUseCase {
  constructor(
    private readonly users: IUserRepository,
    private readonly passwords: IPasswordHasher,
    private readonly tokens: ITokenService,
  ) {}

  /** El registro público siempre crea usuarios con rol `user`. */
  async register(input: Registration): Promise<Session> {
    const user = await this.createUser(input, 'user');
    return this.openSession(user);
  }

  async registerAdmin(input: Registration): Promise<PublicUser> {
    return toPublicUser(await this.createUser(input, 'admin'));
  }

  async login(input: Credentials): Promise<Session> {
    const user = await this.users.findByEmail(input.email);
    // Se compara siempre, incluso sin usuario, para igualar el tiempo de respuesta.
    const matches = await this.passwords.compare(input.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
    if (!user || !matches) {
      throw new UnauthorizedError('Credenciales inválidas.', 'INVALID_CREDENTIALS');
    }
    return this.openSession(user);
  }

  /** Valida el token y comprueba que el usuario siga existiendo; el rol vigente sale de la base de datos. */
  async authenticate(token: string): Promise<AuthenticatedUser> {
    const identity = this.tokens.verify(token);
    if (!identity) {
      throw new UnauthorizedError('El token es inválido o expiró.', 'INVALID_TOKEN');
    }
    const user = await this.users.findById(identity.id);
    if (!user) {
      throw new UnauthorizedError('El token es inválido o expiró.', 'INVALID_TOKEN');
    }
    return { id: user.id, role: user.role };
  }

  async getProfile(userId: string): Promise<PublicUser> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundError('El usuario no existe.');
    return toPublicUser(user);
  }

  private async createUser(input: Registration, role: NewUser['role']) {
    if (await this.users.findByEmail(input.email)) {
      throw new ConflictError('Ya existe una cuenta con ese correo.');
    }
    return this.users.create({
      name: input.name,
      email: input.email,
      passwordHash: await this.passwords.hash(input.password),
      role,
    });
  }

  private openSession(user: User): Session {
    return {
      user: toPublicUser(user),
      token: this.tokens.sign({ id: user.id, role: user.role }),
      expiresIn: this.tokens.expiresInSeconds,
    };
  }
}
