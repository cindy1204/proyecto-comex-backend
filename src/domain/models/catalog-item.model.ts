import type { RecordState } from './record-state.model.js';

export const CATALOG_DIRECTIONS = ['INGRESOS', 'EGRESOS'] as const;

export type CatalogDirection = (typeof CATALOG_DIRECTIONS)[number];

export interface CatalogItem {
  id: string;
  category: string;
  direction: CatalogDirection;
  code: string;
  title: string;
  description: string;
  note: string | null;
  imageUrl: string | null;
  state: RecordState;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CatalogItemKey {
  category: string;
  direction: CatalogDirection;
  code: string;
}

export interface NewCatalogItem extends CatalogItemKey {
  title: string;
  description: string;
  note: string | null;
  imageUrl: string | null;
}

export interface CatalogItemChanges extends Partial<NewCatalogItem> {
  state?: RecordState;
}
