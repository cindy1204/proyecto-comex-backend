import { Router } from 'express';
import { z } from 'zod';
import type { CatalogService } from '../../../application/catalog-service.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { HttpError } from '../middleware/errors.js';
import type { AuthService } from '../../../application/auth-service.js';
import { createAuthenticate, requireAdmin } from '../middleware/auth.js';
import multer from 'multer';
import { uploadCatalogImage } from '../../../infrastructure/catalog-image-storage.js';
import { idSchema } from '../validation.js';

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
  page: z.coerce.number().int().min(1).max(2147483647).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  currentPage: z.coerce.number().int().min(1).max(2147483647).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  category: z.string().trim().min(1).optional(),
  direction: z.enum(['INGRESOS', 'EGRESOS']).optional(),
  search: z.string().trim().max(200).optional(),
}).transform(({ page, pageSize, currentPage, limit, ...filters }) => ({
  ...filters,
  page: currentPage ?? page,
  pageSize: limit ?? pageSize ?? 10,
}));

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(_request, file, callback) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      callback(new HttpError(415, 'UNSUPPORTED_IMAGE_TYPE', 'Usa una imagen JPG, PNG o WebP.'));
      return;
    }
    callback(null, true);
  },
});

export function createCatalogRouter(catalogService: CatalogService, authService: AuthService) {
  const router = Router();
  const authenticate = createAuthenticate(authService);

  router.get('/', asyncHandler(async (request, response) => {
    const query = paginationSchema.parse(request.query);
    response.json(await catalogService.list(query));
  }));

  router.get('/:id', asyncHandler(async (request, response) => {
    const id = idSchema.parse(request.params.id);
    response.json({ data: await catalogService.getActive(id) });
  }));

  router.post('/:id/imagen', authenticate, requireAdmin, imageUpload.single('image'), asyncHandler(async (request, response) => {
    const id = idSchema.parse(request.params.id);
    await catalogService.getActive(id);
    if (!request.file) {
      throw new HttpError(400, 'IMAGE_REQUIRED', 'Selecciona un archivo de imagen para cargar.');
    }
    const imageUrl = await uploadCatalogImage(id, request.file);
    response.json({ data: await catalogService.setImage(id, imageUrl) });
  }));

  router.post('/', authenticate, requireAdmin, asyncHandler(async (request, response) => {
    const input = catalogItemSchema.parse(request.body);
    response.status(201).json({ data: await catalogService.create(input) });
  }));

  router.put('/:id', authenticate, requireAdmin, asyncHandler(async (request, response) => {
    const id = idSchema.parse(request.params.id);
    const input = catalogItemSchema.partial().refine((value) => Object.keys(value).length > 0, {
      message: 'Envía por lo menos un campo para actualizar.',
    }).parse(request.body);
    response.json({ data: await catalogService.update(id, input) });
  }));

  router.delete('/:id', authenticate, requireAdmin, asyncHandler(async (request, response) => {
    const id = idSchema.parse(request.params.id);
    await catalogService.deactivate(id);
    response.status(204).end();
  }));

  return router;
}
