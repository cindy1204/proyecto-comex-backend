import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { ApplicationError } from '../application/errors/application.error.js';
import { logger } from '../infrastructure/logger.js';
import type { Container } from './container.js';
import { errorHandler, notFound } from './middlewares/error.handler.js';
import { createRateLimiters, DEFAULT_RATE_LIMITS, type RateLimits } from './middlewares/rate-limit.middleware.js';
import { createAuthRouter } from './routers/auth.router.js';
import { createCatalogRouter } from './routers/catalog.router.js';
import { createContactRouter } from './routers/contact.router.js';
import { createInteractionsRouter } from './routers/interactions.router.js';
import { createStoredFileRouter } from './routers/stored-file.router.js';

export interface AppOptions {
  corsOrigins: string[];
  rateLimits?: RateLimits;
}

export function createApp(container: Container, options: AppOptions): Express {
  const app = express();
  const limiters = createRateLimiters(options.rateLimits ?? DEFAULT_RATE_LIMITS);
  const { controllers, guards } = container;

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || options.corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new ApplicationError(403, 'CORS_ORIGIN_DENIED', 'El origen no está permitido.'));
      },
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', async (_request, response) => {
    try {
      await container.checkDatabase();
      response.status(200).json({ status: 'ok' });
    } catch (error) {
      logger.error('La comprobación de la base de datos falló.', error);
      response.status(503).json({
        error: { code: 'SERVICE_UNAVAILABLE', message: 'La base de datos no está disponible.' },
      });
    }
  });

  app.use('/api', limiters.api);
  app.use('/api/auth', createAuthRouter(controllers.auth, guards, limiters.auth));
  app.use('/api/catalogos', createCatalogRouter(controllers.catalog, guards, limiters.upload));
  app.use('/api/interacciones', createInteractionsRouter(controllers.interactions, guards));
  app.use('/api/solicitudes-contacto', createContactRouter(controllers.contact, guards, limiters.contact));
  app.use('/api/archivos', createStoredFileRouter(controllers.storedFiles));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
