import { Router } from 'express';
import { z } from 'zod';
import type { CatalogService } from '../../../application/catalog-service.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { HttpError } from '../middleware/errors.js';
import type { AuthService } from '../../../application/auth-service.js';
import { createAuthenticate, requireAdmin } from '../middleware/auth.js';

const catalogItemSchema = z.object({
  category: z.string().trim().min(1).max(80),
  direction: z.enum(['INGRESOS', 'EGRESOS']),
  code: z.string().trim().min(1).max(40),
  title: z.string().trim().min(1).max(250),
  description: z.string().trim().min(1).max(10000),
  note: z.string().trim().max(10000).nullable().optional(),
  active: z.boolean().optional(),
});

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  category: z.string().trim().min(1).optional(),
  direction: z.enum(['INGRESOS', 'EGRESOS']).optional(),
  search: z.string().trim().max(200).optional(),
});

export function createCatalogRouter(catalogService: CatalogService, authService: AuthService) {
  const router = Router();
  const authenticate = createAuthenticate(authService);

  router.get('/', asyncHandler(async (request, response) => {
    const query = paginationSchema.parse(request.query);
    response.json(await catalogService.list(query));
  }));

  router.get('/:id', asyncHandler(async (request, response) => {
    const id = z.string().min(1).max(64).parse(request.params.id);
    response.json({ data: await catalogService.getActive(id) });
  }));

  router.post('/', authenticate, requireAdmin, asyncHandler(async (request, response) => {
    const input = catalogItemSchema.parse(request.body);
    response.status(201).json({ data: await catalogService.create(input) });
  }));

  router.put('/:id', authenticate, requireAdmin, asyncHandler(async (request, response) => {
    const id = z.string().min(1).max(64).parse(request.params.id);
    const input = catalogItemSchema.partial().refine((value) => Object.keys(value).length > 0, {
      message: 'Envía por lo menos un campo para actualizar.',
    }).parse(request.body);
    response.json({ data: await catalogService.update(id, input) });
  }));

  router.delete('/:id', authenticate, requireAdmin, asyncHandler(async (request, response) => {
    const id = z.string().min(1).max(64).parse(request.params.id);
    await catalogService.deactivate(id);
    response.status(204).end();
  }));

  return router;
}
