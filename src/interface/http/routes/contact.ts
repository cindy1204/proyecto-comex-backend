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

export function createContactRouter(contactService: ContactService, authService: AuthService) {
  const router = Router();
  const authenticate = createAuthenticate(authService);
  const optionalAuthenticate = createOptionalAuthenticate(authService);

  router.get('/mias', authenticate, asyncHandler(async (request, response) => {
    response.json({ data: await contactService.findByUser(request.auth!.userId) });
  }));

  router.get('/', authenticate, requireAdmin, asyncHandler(async (_request, response) => {
    response.json({ data: await contactService.findAll() });
  }));

  router.post('/', contactRateLimit, optionalAuthenticate, asyncHandler(async (request, response) => {
    const input = contactSchema.parse(request.body);
    response.status(201).json({ data: await contactService.create(input, request.auth?.userId) });
  }));
  return router;
}
