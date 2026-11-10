import { Router } from 'express';
import { z } from 'zod';
import type { InteractionService } from '../../../application/interaction-service.js';
import type { AuthService } from '../../../application/auth-service.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { createAuthenticate, requireAdmin } from '../middleware/auth.js';
import { idSchema } from '../validation.js';

const interactionSchema = z.object({
  type: z.enum(['formulario-importaciones', 'formulario-exportaciones']),
  data: z.record(z.string(), z.json()),
}).strict();
const interactionUpdateSchema = interactionSchema.partial().strict()
  .refine((value) => Object.keys(value).length > 0, 'Envía por lo menos un campo para actualizar.');
const interactionListSchema = z.object({
  page: z.coerce.number().int().min(1).max(2147483647).default(1),
  currentPage: z.coerce.number().int().min(1).max(2147483647).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  type: z.enum(['formulario-importaciones', 'formulario-exportaciones']).optional(),
}).transform(({ page, pageSize, currentPage, limit, ...filters }) => ({
  ...filters,
  page: currentPage ?? page,
  pageSize: limit ?? pageSize ?? 10,
}));

export function createInteractionRouter(
  interactionService: InteractionService,
  authService: AuthService,
) {
  const router = Router();
  router.use(createAuthenticate(authService));

  router.get('/mias', asyncHandler(async (request, response) => {
    const query = interactionListSchema.parse(request.query);
    response.json(await interactionService.findMine(request.auth!.userId, query));
  }));

  router.get('/', requireAdmin, asyncHandler(async (request, response) => {
    const query = interactionListSchema.parse(request.query);
    response.json(await interactionService.findAll(query));
  }));

  router.post('/', asyncHandler(async (request, response) => {
    const input = interactionSchema.parse(request.body);
    const data: Record<string, unknown> = input.data;
    const interaction = await interactionService.create(request.auth!.userId, input.type, data);
    response.status(201).json({ data: interaction });
  }));

  router.get('/:id', asyncHandler(async (request, response) => {
    const id = idSchema.parse(request.params.id);
    response.json({ data: await interactionService.findOne(id, { id: request.auth!.userId, role: request.auth!.role }) });
  }));

  router.put('/:id', asyncHandler(async (request, response) => {
    const id = idSchema.parse(request.params.id);
    const input = interactionUpdateSchema.parse(request.body);
    response.json({ data: await interactionService.update(id, { id: request.auth!.userId, role: request.auth!.role }, input) });
  }));

  router.delete('/:id', asyncHandler(async (request, response) => {
    const id = idSchema.parse(request.params.id);
    await interactionService.delete(id, { id: request.auth!.userId, role: request.auth!.role });
    response.status(204).end();
  }));

  return router;
}
