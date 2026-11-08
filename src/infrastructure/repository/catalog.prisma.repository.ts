import type { CatalogItem as CatalogItemRow, Prisma, PrismaClient } from '@prisma/client';
import type {
  CatalogItem,
  CatalogItemChanges,
  CatalogItemKey,
  NewCatalogItem,
} from '../../domain/models/catalog-item.model.js';
import type { Page } from '../../domain/models/page.model.js';
import type { CatalogFilter, ICatalogRepository } from '../../domain/repository/ICatalog.repository.js';
import { createdAtRange } from './query-helpers.js';

function toDomain(row: CatalogItemRow): CatalogItem {
  return { ...row };
}

export class CatalogPrismaRepository implements ICatalogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(filter: CatalogFilter): Promise<Page<CatalogItem>> {
    const where: Prisma.CatalogItemWhereInput = {
      ...(filter.state ? { state: filter.state } : {}),
      ...(filter.category ? { category: filter.category } : {}),
      ...(filter.direction ? { direction: filter.direction } : {}),
      ...createdAtRange(filter),
      ...(filter.search
        ? {
            OR: [
              { code: { contains: filter.search, mode: 'insensitive' } },
              { title: { contains: filter.search, mode: 'insensitive' } },
              { description: { contains: filter.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.catalogItem.count({ where }),
      this.prisma.catalogItem.findMany({
        where,
        orderBy: [{ category: 'asc' }, { direction: 'asc' }, { code: 'asc' }],
        skip: (filter.page - 1) * filter.limit,
        take: filter.limit,
      }),
    ]);
    return { items: rows.map(toDomain), total };
  }

  async findById(id: string): Promise<CatalogItem | null> {
    const row = await this.prisma.catalogItem.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findByKey(key: CatalogItemKey): Promise<CatalogItem | null> {
    const row = await this.prisma.catalogItem.findUnique({
      where: {
        category_direction_code: { category: key.category, direction: key.direction, code: key.code },
      },
    });
    return row ? toDomain(row) : null;
  }

  async findActiveByCategoryAndCode(category: string, code: string): Promise<CatalogItem | null> {
    const row = await this.prisma.catalogItem.findFirst({
      where: { category, code, state: 'ACTIVE' },
    });
    return row ? toDomain(row) : null;
  }

  async create(item: NewCatalogItem): Promise<CatalogItem> {
    return toDomain(await this.prisma.catalogItem.create({ data: item }));
  }

  async update(id: string, changes: CatalogItemChanges): Promise<CatalogItem> {
    const restoring = changes.state === 'ACTIVE';
    const row = await this.prisma.catalogItem.update({
      where: { id },
      data: { ...changes, ...(restoring ? { deletedAt: null } : {}) },
    });
    return toDomain(row);
  }

  async remove(id: string): Promise<void> {
    await this.prisma.catalogItem.update({
      where: { id },
      data: { state: 'REMOVED', deletedAt: new Date() },
    });
  }
}
