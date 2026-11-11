import { z } from 'zod';
import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from '../../application/pagination.js';

z.config(z.locales.es());

const NULL_CHARACTER = '\u0000';

/** PostgreSQL rechaza el carácter nulo en textos y JSON; se descarta antes de llegar a la base de datos. */
export function hasNullCharacter(value: unknown): boolean {
  if (typeof value === 'string') return value.includes(NULL_CHARACTER);
  if (Array.isArray(value)) return value.some(hasNullCharacter);
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).some(([key, item]) => hasNullCharacter(key) || hasNullCharacter(item));
  }
  return false;
}

export const NO_NULL_MESSAGE = 'No puede contener caracteres nulos.';

/** Texto recortado, con longitud acotada y sin caracteres nulos. */
export const text = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((value) => !value.includes(NULL_CHARACTER), NO_NULL_MESSAGE);

export const emailField = z
  .string()
  .trim()
  .max(254)
  .pipe(z.email('Ingresa un correo electrónico válido.'))
  .transform((email) => email.toLowerCase());

export const idSchema = z.cuid('El identificador no es válido.');

export const idParamsSchema = z.object({ id: idSchema });

/** Los parámetros de query vacíos (`?search=`) se tratan como ausentes. */
export const optionalQuery = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

/** Entero positivo con valor por defecto; `?page=` vacío se trata como ausente, igual que las fechas. */
const positiveInt = (name: string, fallback: number, max: number) =>
  optionalQuery(
    z
      .string()
      .regex(/^\d+$/, `${name} debe ser un entero mayor o igual a 1.`)
      .transform(Number)
      .pipe(
        z
          .number()
          .int()
          .min(1, `${name} debe ser un entero mayor o igual a 1.`)
          .max(max, `${name} no puede ser mayor a ${max}.`),
      ),
  ).transform((value) => value ?? fallback);

export const paginationShape = {
  page: positiveInt('page', DEFAULT_PAGE, 1_000_000),
  limit: positiveInt('limit', DEFAULT_LIMIT, MAX_LIMIT),
};

const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
const isoDate = z.union([z.iso.datetime({ offset: true }), z.iso.date()]);

/** Fechas ISO; `createdTo` con solo fecha incluye el día completo. */
export const dateRangeShape = {
  createdFrom: optionalQuery(isoDate.transform((value) => new Date(value))),
  createdTo: optionalQuery(
    isoDate.transform((value) => new Date(dateOnly.test(value) ? `${value}T23:59:59.999Z` : value)),
  ),
};

export function rejectInvertedRange(
  value: { createdFrom?: Date | undefined; createdTo?: Date | undefined },
  context: z.core.$RefinementCtx,
): void {
  if (value.createdFrom && value.createdTo && value.createdFrom > value.createdTo) {
    context.addIssue({
      code: 'custom',
      path: ['createdFrom'],
      message: 'createdFrom no puede ser posterior a createdTo.',
    });
  }
}
