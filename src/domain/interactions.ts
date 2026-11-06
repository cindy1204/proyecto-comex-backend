import type { CatalogItemRecord } from './catalog.js';
import type { UserRoleName } from './auth.js';
import type { PaginatedResult, PaginationQuery } from './pagination.js';

export interface InteractionRecord {
  id: string;
  userId: string;
  catalogItemId: string;
  type: string;
  data: Record<string, unknown>;
  createdAt: Date;
  user?: { id: string; name: string; email: string };
  catalogItem: Pick<CatalogItemRecord, 'id' | 'category' | 'code' | 'title'>;
}

export interface InteractionRepository {
  create(input: {
    userId: string;
    catalogItemId: string;
    type: string;
    data: Record<string, unknown>;
  }): Promise<InteractionRecord>;
  findById(id: string): Promise<InteractionRecord | null>;
  list(filter: PaginationQuery & { userId?: string; type?: string }): Promise<PaginatedResult<InteractionRecord>>;
  update(id: string, input: { type: string; catalogItemId: string; data: Record<string, unknown> }): Promise<InteractionRecord>;
  delete(id: string): Promise<void>;
}

export type InteractionOwner = { id: string; role: UserRoleName };
