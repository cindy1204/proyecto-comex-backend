import type { CatalogItemRecord } from './catalog.js';
import type { UserRoleName } from './auth.js';

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
  findByUser(userId: string): Promise<InteractionRecord[]>;
  findAll(): Promise<InteractionRecord[]>;
}

export type InteractionOwner = { id: string; role: UserRoleName };
