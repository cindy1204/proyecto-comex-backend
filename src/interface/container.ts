import { AuthUseCase } from '../application/use-cases/auth.use-case.js';
import { CatalogUseCase } from '../application/use-cases/catalog.use-case.js';
import { ContactUseCase } from '../application/use-cases/contact.use-case.js';
import { InteractionsUseCase } from '../application/use-cases/interactions.use-case.js';
import type { ICatalogRepository } from '../domain/repository/ICatalog.repository.js';
import type { IContactRepository } from '../domain/repository/IContact.repository.js';
import type { IInteractionRepository } from '../domain/repository/IInteraction.repository.js';
import type { IUserRepository } from '../domain/repository/IUser.repository.js';
import type { IFileStorage } from '../domain/services/IFileStorage.js';
import type { IPasswordHasher } from '../domain/services/IPasswordHasher.js';
import type { ITokenService } from '../domain/services/ITokenService.js';
import type { AppConfig } from '../infrastructure/config.js';
import { createPrismaClient } from '../infrastructure/prisma-client.js';
import { CatalogPrismaRepository } from '../infrastructure/repository/catalog.prisma.repository.js';
import { ContactPrismaRepository } from '../infrastructure/repository/contact.prisma.repository.js';
import { InteractionPrismaRepository } from '../infrastructure/repository/interaction.prisma.repository.js';
import { UserPrismaRepository } from '../infrastructure/repository/user.prisma.repository.js';
import { BcryptPasswordHasher } from '../infrastructure/services/bcrypt.service.js';
import { JwtTokenService } from '../infrastructure/services/jwt.service.js';
import { SupabaseStorageService } from '../infrastructure/services/supabase-storage.service.js';
import { AuthController } from './controllers/auth.controller.js';
import { CatalogController } from './controllers/catalog.controller.js';
import { ContactController } from './controllers/contact.controller.js';
import { InteractionsController } from './controllers/interactions.controller.js';
import { createGuards, type Guards } from './middlewares/auth.middleware.js';

/** Implementaciones concretas de los puertos del dominio; los tests inyectan versiones en memoria. */
export interface Infrastructure {
  users: IUserRepository;
  catalog: ICatalogRepository;
  interactions: IInteractionRepository;
  contacts: IContactRepository;
  passwords: IPasswordHasher;
  tokens: ITokenService;
  files: IFileStorage;
  /** Lanza si la base de datos no responde; alimenta `GET /health`. */
  checkDatabase: () => Promise<void>;
}

export interface Container {
  guards: Guards;
  controllers: {
    auth: AuthController;
    catalog: CatalogController;
    interactions: InteractionsController;
    contact: ContactController;
  };
  checkDatabase: () => Promise<void>;
  shutdown: () => Promise<void>;
}

/** Raíz de composición: único lugar donde se instancian casos de uso y controladores. */
export function buildContainer(infra: Infrastructure, shutdown: () => Promise<void> = async () => {}): Container {
  const auth = new AuthUseCase(infra.users, infra.passwords, infra.tokens);
  const catalog = new CatalogUseCase(infra.catalog, infra.files);
  const interactions = new InteractionsUseCase(infra.catalog, infra.interactions);
  const contacts = new ContactUseCase(infra.contacts);

  return {
    guards: createGuards(auth),
    controllers: {
      auth: new AuthController(auth),
      catalog: new CatalogController(catalog),
      interactions: new InteractionsController(interactions),
      contact: new ContactController(contacts),
    },
    checkDatabase: infra.checkDatabase,
    shutdown,
  };
}

/** Contenedor de producción: Prisma, bcrypt, JWT y Supabase Storage. */
export function createContainer(config: AppConfig): Container {
  const prisma = createPrismaClient(config.databaseUrl);

  return buildContainer(
    {
      users: new UserPrismaRepository(prisma),
      catalog: new CatalogPrismaRepository(prisma),
      interactions: new InteractionPrismaRepository(prisma),
      contacts: new ContactPrismaRepository(prisma),
      passwords: new BcryptPasswordHasher(),
      tokens: new JwtTokenService(config.jwtSecret, config.jwtExpiresInSeconds),
      files: new SupabaseStorageService(config.supabase),
      checkDatabase: async () => {
        await prisma.$queryRaw`SELECT 1`;
      },
    },
    () => prisma.$disconnect(),
  );
}
