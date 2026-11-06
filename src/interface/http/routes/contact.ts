import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import type { ContactService } from '../../../application/contact-service.js';
import { asyncHandler } from '../middleware/async-handler.js';
import type { AuthService } from '../../../application/auth-service.js';
import { createAuthenticate, createOptionalAuthenticate, requireAdmin } from '../middleware/auth.js';

const contactRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

const contactSchema = z.object({
  nombreCompleto: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  empresa: z.string().trim().max(160).optional().default(''),
  telefono: z.string().trim().max(40).optional().default(''),
  tipoProducto: z.enum(['importaciones', 'exportaciones', 'deudaExterna', 'inversiones', 'servicios']),
  descripcionCaso: z.string().trim().min(1).max(2000),
}).strict();
const contactUpdateSchema = z.object({
  nombreCompleto: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()).optional(),
  empresa: z.string().trim().max(160).optional(),
  telefono: z.string().trim().max(40).optional(),
  tipoProducto: z.enum(['importaciones', 'exportaciones', 'deudaExterna', 'inversiones', 'servicios']).optional(),
  descripcionCaso: z.string().trim().min(1).max(2000).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: 'Envía por lo menos un campo para actualizar.',
});
const contactListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  currentPage: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  tipoProducto: z.enum(['importaciones', 'exportaciones', 'deudaExterna', 'inversiones', 'servicios']).optional(),
  search: z.string().trim().max(200).optional(),
}).transform(({ page, pageSize, currentPage, limit, ...filters }) => ({
  ...filters,
  page: currentPage ?? page,
  pageSize: limit ?? pageSize ?? 10,
}));

export function createContactRouter(contactService: ContactService, authService: AuthService) {
  const router = Router();
  const authenticate = createAuthenticate(authService);
  const optionalAuthenticate = createOptionalAuthenticate(authService);

  router.get('/mias', authenticate, asyncHandler(async (request, response) => {
    const query = contactListSchema.parse(request.query);
    response.json(await contactService.findByUser(request.auth!.userId, query));
  }));

  router.get('/', authenticate, requireAdmin, asyncHandler(async (request, response) => {
    const query = contactListSchema.parse(request.query);
    response.json(await contactService.findAll(query));
  }));

  router.post('/', contactRateLimit, optionalAuthenticate, asyncHandler(async (request, response) => {
    const input = contactSchema.parse(request.body);
    response.status(201).json({ data: await contactService.create(input, request.auth?.userId) });
  }));

  router.post('/formularios', contactRateLimit, authenticate, asyncHandler(async (request, response) => {
    const input = contactSchema.parse(request.body);
    response.status(201).json({ data: await contactService.create(input, request.auth!.userId) });
  }));

  router.get('/:id', authenticate, asyncHandler(async (request, response) => {
    const id = z.string().min(1).max(64).parse(request.params.id);
    response.json({ data: await contactService.findOne(id, request.auth!.userId, request.auth!.role) });
  }));

  router.put('/:id', authenticate, asyncHandler(async (request, response) => {
    const id = z.string().min(1).max(64).parse(request.params.id);
    const input = contactUpdateSchema.parse(request.body);
    const { descripcionCaso, ...fields } = input;
    response.json({
      data: await contactService.update(id, request.auth!.userId, request.auth!.role, {
        ...fields,
        ...(descripcionCaso !== undefined ? { descripcionCaso } : {}),
      }),
    });
  }));

  router.delete('/:id', authenticate, asyncHandler(async (request, response) => {
    const id = z.string().min(1).max(64).parse(request.params.id);
    await contactService.delete(id, request.auth!.userId, request.auth!.role);
    response.status(204).end();
  }));

  return router;
}
