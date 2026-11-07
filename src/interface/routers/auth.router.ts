import { Router, type RequestHandler } from 'express';
import type { AuthController } from '../controllers/auth.controller.js';
import type { Guards } from '../middlewares/auth.middleware.js';

export function createAuthRouter(controller: AuthController, guards: Guards, authLimiter: RequestHandler): Router {
  const router = Router();

  router.post('/register', authLimiter, controller.register);
  router.post('/login', authLimiter, controller.login);
  router.get('/me', guards.authenticate, controller.me);
  router.post('/admins', guards.authenticate, guards.requireAdmin, controller.registerAdmin);

  return router;
}
