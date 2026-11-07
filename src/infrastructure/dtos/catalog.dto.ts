import { z } from 'zod';
import type {
  CatalogListQuery,
  CreateCatalogItemInput,
  UpdateCatalogItemInput,
} from '../../application/use-cases/catalog.use-case.js';
import { CATALOG_DIRECTIONS } from '../../domain/models/catalog-item.model.js';
import { dateRangeShape, optionalQuery, paginationShape, rejectInvertedRange, text } from './shared.dto.js';

/** En multipart no se puede enviar `null`: una nota vacía equivale a no tener nota. */
const note = text(0, 10_000)
  .nullable()
  .transform((value) => (value === '' ? null : value));

const catalogFields = {
  category: text(1, 80),
  direction: z.enum(CATALOG_DIRECTIONS),
  code: text(1, 40),
  title: text(1, 250),
  description: text(1, 10_000),
  note: note.optional(),
};

/** `imageUrl` no se acepta: la imagen se envía como archivo `image` en multipart. */
const createSchema = z.strictObject(catalogFields);

const updateSchema = z.strictObject({
  category: catalogFields.category.optional(),
  direction: catalogFields.direction.optional(),
  code: catalogFields.code.optional(),
  title: catalogFields.title.optional(),
  description: catalogFields.description.optional(),
  note: catalogFields.note,
  state: z.literal('ACTIVE').optional(),
});

const listSchema = z
  .object({
    ...paginationShape,
    ...dateRangeShape,
    category: optionalQuery(text(1, 80)),
    direction: optionalQuery(z.enum(CATALOG_DIRECTIONS)),
    search: optionalQuery(text(1, 200)),
    state: optionalQuery(z.enum(['ACTIVE', 'REMOVED', 'ALL'])),
  })
  .superRefine(rejectInvertedRange);

export const parseCatalogCreateBody = (body: unknown): CreateCatalogItemInput => createSchema.parse(body);

export const parseCatalogUpdateBody = (body: unknown): UpdateCatalogItemInput => updateSchema.parse(body);

export const parseCatalogListQuery = (query: unknown): CatalogListQuery => listSchema.parse(query);
