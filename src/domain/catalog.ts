export type CatalogDirection = 'INGRESOS' | 'EGRESOS';

export interface CatalogItemRecord {
  id: string;
  category: string;
  direction: CatalogDirection;
  code: string;
  title: string;
  description: string;
  note: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CatalogFilter {
  page: number;
  pageSize: number;
  category?: string;
  direction?: CatalogDirection;
  search?: string;
}

export interface CatalogItemInput {
  category: string;
  direction: CatalogDirection;
  code: string;
  title: string;
  description: string;
  note?: string | null;
  active?: boolean;
}

export interface CatalogRepository {
  list(filter: CatalogFilter): Promise<{
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
    data: CatalogItemRecord[];
  }>;
  findActiveById(id: string): Promise<CatalogItemRecord | null>;
  findActiveByCategoryAndCode(category: string, code: string): Promise<CatalogItemRecord | null>;
  create(item: CatalogItemInput): Promise<CatalogItemRecord>;
  update(id: string, item: Partial<CatalogItemInput>): Promise<CatalogItemRecord>;
  deactivate(id: string): Promise<void>;
}
