import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { AuthService } from '../../application/auth-service.js';
import { CatalogService } from '../../application/catalog-service.js';
import { ContactService } from '../../application/contact-service.js';
import { InteractionService } from '../../application/interaction-service.js';
import { config } from '../../infrastructure/config.js';
import { PrismaCatalogRepository, PrismaContactRepository, PrismaInteractionRepository } from '../../infrastructure/prisma-repositories.js';
import { PrismaUserRepository } from '../../infrastructure/prisma-user-repository.js';
import { prisma } from '../../infrastructure/prisma-client.js';
import { BcryptPasswordHasher, JwtTokenService } from '../../infrastructure/security.js';
import { asyncHandler } from './middleware/async-handler.js';
import { errorHandler, HttpError, notFound } from './middleware/errors.js';
import { createAuthRouter } from './routes/auth.js';
import { createCatalogRouter } from './routes/catalog.js';
import { createContactRouter } from './routes/contact.js';
import { createInteractionRouter } from './routes/interactions.js';

export const app = express();
const userRepository = new PrismaUserRepository();
const catalogRepository = new PrismaCatalogRepository();
const interactionRepository = new PrismaInteractionRepository();
const contactRepository = new PrismaContactRepository();
const authService = new AuthService(userRepository, new BcryptPasswordHasher(), new JwtTokenService());
const catalogService = new CatalogService(catalogRepository);
const interactionService = new InteractionService(catalogRepository, interactionRepository);
const contactService = new ContactService(contactRepository);

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || config.corsOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new HttpError(403, 'CORS_ORIGIN_DENIED', 'El origen no está permitido por CORS.'));
  },
}));
app.use(express.json({ limit: '1mb' }));

app.get('/health', asyncHandler(async (_request, response) => {
  await prisma.$queryRaw`SELECT 1`;
  response.json({ status: 'ok' });
}));

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});
app.use('/api/auth', authRateLimit, createAuthRouter(authService));
app.use('/api/catalogo', createCatalogRouter(catalogService, authService));
app.use('/api/contacto', createContactRouter(contactService, authService));
app.use('/api/interaccion', createInteractionRouter(interactionService, authService));
app.use(notFound);
app.use(errorHandler);
