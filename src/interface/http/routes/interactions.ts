import { Router } from 'express';
import { z } from 'zod';
import type { InteractionService } from '../../../application/interaction-service.js';
import type { AuthService } from '../../../application/auth-service.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { createAuthenticate, requireAdmin } from '../middleware/auth.js';

const interactionSchema = z.object({
  type: z.enum(['formulario-importaciones', 'formulario-exportaciones']),
  data: z.record(z.string(), z.json()),
}).strict();

export function createInteractionRouter(
  interactionService: InteractionService,
  authService: AuthService,
) {
  const router = Router();
  router.use(createAuthenticate(authService));

  router.post('/', asyncHandler(async (request, response) => {
    const input = interactionSchema.parse(request.body);
    const data: Record<string, unknown> = input.data;
    const interaction = await interactionService.create(request.auth!.userId, input.type, data);
    response.status(201).json({ data: interaction });
  }));

  router.get('/mias', asyncHandler(async (request, response) => {
    response.json({ data: await interactionService.findMine(request.auth!.userId) });
  }));

  router.get('/', requireAdmin, asyncHandler(async (_request, response) => {
    response.json({ data: await interactionService.findAll() });
  }));

  return router;
}
