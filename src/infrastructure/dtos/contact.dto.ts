import { z } from 'zod';
import type { ContactListQuery, CreateContactInput } from '../../application/use-cases/contact.use-case.js';
import type { ContactRequestChanges } from '../../domain/models/contact-request.model.js';
import { PRODUCT_TYPES } from '../../domain/models/contact-request.model.js';
import { dateRangeShape, emailField, optionalQuery, paginationShape, rejectInvertedRange, text } from './shared.dto.js';

const MAX_INTEGER_DIGITS = 12;
const AMOUNT_PATTERN = new RegExp(`^\\d{1,${MAX_INTEGER_DIGITS}}(\\.\\d{1,2})?$`);

/** Monto en USD: acepta número o cadena decimal y se conserva como cadena (sin pérdida por coma flotante). */
const amount = z
  .union([z.number().nonnegative().finite(), z.string().trim()])
  .transform((value) => String(value))
  .refine(
    (value) => AMOUNT_PATTERN.test(value),
    'El monto debe ser un valor en USD mayor o igual a 0 con máximo 2 decimales.',
  );

const optionalText = (max: number) =>
  text(0, max)
    .nullable()
    .transform((value) => (value ? value : null));

const contactFields = {
  nombreCompleto: text(2, 120),
  email: emailField,
  empresa: optionalText(160),
  telefono: optionalText(40),
  tipoProducto: z.enum(PRODUCT_TYPES),
  descripcionCaso: text(1, 2000),
  montoEstimado: amount.nullable(),
};

const createSchema = z.strictObject({
  nombreCompleto: contactFields.nombreCompleto,
  email: contactFields.email,
  empresa: contactFields.empresa.optional().transform((value) => value ?? null),
  telefono: contactFields.telefono.optional().transform((value) => value ?? null),
  tipoProducto: contactFields.tipoProducto,
  descripcionCaso: contactFields.descripcionCaso,
  montoEstimado: contactFields.montoEstimado.optional().transform((value) => value ?? null),
});

const updateSchema = z.strictObject({
  nombreCompleto: contactFields.nombreCompleto.optional(),
  email: contactFields.email.optional(),
  empresa: contactFields.empresa.optional(),
  telefono: contactFields.telefono.optional(),
  tipoProducto: contactFields.tipoProducto.optional(),
  descripcionCaso: contactFields.descripcionCaso.optional(),
  montoEstimado: contactFields.montoEstimado.optional(),
});

const listSchema = z
  .object({
    ...paginationShape,
    ...dateRangeShape,
    tipoProducto: optionalQuery(z.enum(PRODUCT_TYPES)),
    search: optionalQuery(text(1, 200)),
  })
  .superRefine(rejectInvertedRange);

export const parseContactCreateBody = (body: unknown): CreateContactInput => createSchema.parse(body);
export const parseContactUpdateBody = (body: unknown): ContactRequestChanges => updateSchema.parse(body);
export const parseContactListQuery = (query: unknown): ContactListQuery => listSchema.parse(query);
