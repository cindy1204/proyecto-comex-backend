import { Router } from 'express';
import type { InteractionsController } from '../controllers/interactions.controller.js';
import type { Guards } from '../middlewares/auth.middleware.js';

export function createInteractionsRouter(controller: InteractionsController, guards: Guards): Router {
  const router = Router();

  router.use(guards.authenticate);

  router.post('/', controller.create);
  router.get('/', guards.requireAdmin, controller.listAll);
  router.get('/mias', controller.listMine);
  router.get('/:id', controller.getById);
  // PUT y PATCH son equivalentes: los esquemas de actualización son parciales.
  router.put('/:id', controller.update);
  router.patch('/:id', controller.update);
  router.delete('/:id', controller.remove);

  return router;
}
