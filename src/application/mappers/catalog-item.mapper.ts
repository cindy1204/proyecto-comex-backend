import type { CatalogDirection, CatalogItem } from '../../domain/models/catalog-item.model.js';
import type { RecordState } from '../../domain/models/record-state.model.js';

export interface CatalogItemView {
  id: string;
  category: string;
  direction: CatalogDirection;
  code: string;
  title: string;
  description: string;
  note: string | null;
  imageUrl: string | null;
  state: RecordState;
  createdAt: Date;
  updatedAt: Date;
}

export function toCatalogItemView(item: CatalogItem): CatalogItemView {
  return {
    id: item.id,
    category: item.category,
    direction: item.direction,
    code: item.code,
    title: item.title,
    description: item.description,
    note: item.note,
    imageUrl: item.imageUrl,
    state: item.state,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}
