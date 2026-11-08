import type { Prisma } from '@prisma/client';
import type { DateRange } from '../../domain/models/page.model.js';

export function createdAtRange(range: DateRange): { createdAt?: Prisma.DateTimeFilter } {
  if (!range.createdFrom && !range.createdTo) return {};
  return {
    createdAt: {
      ...(range.createdFrom ? { gte: range.createdFrom } : {}),
      ...(range.createdTo ? { lte: range.createdTo } : {}),
    },
  };
}
