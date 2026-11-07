import { Router, type RequestHandler } from 'express';
import type { CatalogController } from '../controllers/catalog.controller.js';
import type { Guards } from '../middlewares/auth.middleware.js';
import { uploadImage } from '../middlewares/upload.middleware.js';

export function createCatalogRouter(
  controller: CatalogController,
  guards: Guards,
  writeLimiter: RequestHandler,
): Router {
  const router = Router();
  const adminWrite = [guards.authenticate, guards.requireAdmin, writeLimiter] as const;

  router.get('/', guards.optionalAuthenticate, controller.list);
  router.get('/:id', guards.optionalAuthenticate, controller.getById);
  router.post('/', ...adminWrite, uploadImage, controller.create);
  router.put('/:id', ...adminWrite, uploadImage, controller.update);
  router.delete('/:id', guards.authenticate, guards.requireAdmin, controller.remove);

  return router;
}
