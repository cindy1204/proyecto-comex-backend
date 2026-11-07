import { Router, type RequestHandler } from 'express';
import type { ContactController } from '../controllers/contact.controller.js';
import type { Guards } from '../middlewares/auth.middleware.js';

export function createContactRouter(
  controller: ContactController,
  guards: Guards,
  contactLimiter: RequestHandler,
): Router {
  const router = Router();

  router.post('/', contactLimiter, guards.optionalAuthenticate, controller.create);
  router.get('/', guards.authenticate, guards.requireAdmin, controller.listAll);
  router.get('/mias', guards.authenticate, controller.listMine);
  router.get('/:id', guards.authenticate, controller.getById);
  router.put('/:id', guards.authenticate, controller.update);
  router.delete('/:id', guards.authenticate, controller.remove);

  return router;
}
