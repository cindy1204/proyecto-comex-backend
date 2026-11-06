import type { CatalogFilter, CatalogItemInput, CatalogItemUpdate, CatalogRepository } from '../domain/catalog.js';
import { ApplicationError } from '../domain/errors.js';

export class CatalogService {
  constructor(private readonly catalog: CatalogRepository) {}

  list(filter: CatalogFilter) {
    return this.catalog.list(filter);
  }

  async getActive(id: string) {
    const item = await this.catalog.findActiveById(id);
    if (!item) throw new ApplicationError(404, 'NOT_FOUND', 'El numeral no existe.');
    return item;
  }

  create(item: CatalogItemInput) {
    return this.catalog.create(item);
  }

  update(id: string, item: Partial<CatalogItemInput>) {
    return this.catalog.update(id, item);
  }

  async setImage(id: string, imageUrl: string) {
    const item = await this.catalog.findById(id);
    if (!item) throw new ApplicationError(404, 'NOT_FOUND', 'El numeral no existe.');
    return this.catalog.update(id, { imageUrl } satisfies CatalogItemUpdate);
  }

  deactivate(id: string) {
    return this.catalog.deactivate(id);
  }
}
