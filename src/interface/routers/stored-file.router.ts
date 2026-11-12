import { Router } from 'express';
import type { StoredFileController } from '../controllers/stored-file.controller.js';

/** Imágenes guardadas en la base de datos; públicas porque el catálogo también lo es. */
export function createStoredFileRouter(controller: StoredFileController): Router {
  const router = Router();
  router.get('/:id', controller.get);
  return router;
}
