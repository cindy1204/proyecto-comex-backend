import type {
  CatalogDirection,
  CatalogItem,
  CatalogItemChanges,
  CatalogItemKey,
  NewCatalogItem,
} from '../models/catalog-item.model.js';
import type { DateRange, Page, PageRequest } from '../models/page.model.js';
import type { RecordState } from '../models/record-state.model.js';

export interface CatalogFilter extends PageRequest, DateRange {
  /** `undefined` incluye ítems en cualquier estado. */
  state?: RecordState;
  category?: string;
  direction?: CatalogDirection;
  search?: string;
}

export interface ICatalogRepository {
  list(filter: CatalogFilter): Promise<Page<CatalogItem>>;
  findById(id: string): Promise<CatalogItem | null>;
  findByKey(key: CatalogItemKey): Promise<CatalogItem | null>;
  findActiveByCategoryAndCode(category: string, code: string): Promise<CatalogItem | null>;
  create(item: NewCatalogItem): Promise<CatalogItem>;
  update(id: string, changes: CatalogItemChanges): Promise<CatalogItem>;
  remove(id: string): Promise<void>;
}
