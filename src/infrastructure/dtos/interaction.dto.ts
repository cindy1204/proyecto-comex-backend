import { z } from 'zod';
import type {
  CreateInteractionInput,
  InteractionListQuery,
  UpdateInteractionInput,
} from '../../application/use-cases/interactions.use-case.js';
import { INTERACTION_TYPES } from '../../domain/models/interaction.model.js';
import {
  NO_NULL_MESSAGE,
  dateRangeShape,
  hasNullCharacter,
  idSchema,
  optionalQuery,
  paginationShape,
  rejectInvertedRange,
} from './shared.dto.js';

const typeSchema = z.enum(INTERACTION_TYPES);
const dataSchema = z.record(z.string(), z.json()).refine((data) => !hasNullCharacter(data), NO_NULL_MESSAGE);

const createSchema = z.strictObject({ type: typeSchema, data: dataSchema });
const updateSchema = z.strictObject({ type: typeSchema.optional(), data: dataSchema.optional() });

const listSchema = z
  .object({
    ...paginationShape,
    ...dateRangeShape,
    type: optionalQuery(typeSchema),
  })
  .superRefine(rejectInvertedRange);

const adminListSchema = z
  .object({
    ...paginationShape,
    ...dateRangeShape,
    type: optionalQuery(typeSchema),
    userId: optionalQuery(idSchema),
  })
  .superRefine(rejectInvertedRange);

export const parseInteractionCreateBody = (body: unknown): CreateInteractionInput => createSchema.parse(body);
export const parseInteractionUpdateBody = (body: unknown): UpdateInteractionInput => updateSchema.parse(body);
export const parseMyInteractionsQuery = (query: unknown): InteractionListQuery => listSchema.parse(query);
export const parseInteractionListQuery = (query: unknown): InteractionListQuery => adminListSchema.parse(query);
