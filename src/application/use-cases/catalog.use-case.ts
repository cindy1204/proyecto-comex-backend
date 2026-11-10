import type {
  CatalogDirection,
  CatalogItem,
  CatalogItemChanges,
  CatalogItemKey,
  NewCatalogItem,
} from '../../domain/models/catalog-item.model.js';
import type { DateRange, PageRequest } from '../../domain/models/page.model.js';
import type { RecordState } from '../../domain/models/record-state.model.js';
import type { AuthenticatedUser } from '../../domain/models/user.model.js';
import type { ICatalogRepository } from '../../domain/repository/ICatalog.repository.js';
import { FileStorageError, type FileToUpload, type IFileStorage } from '../../domain/services/IFileStorage.js';
import { assertHasChanges } from '../assert-has-changes.js';
import { BadGatewayError } from '../errors/bad-gateway.error.js';
import { ConflictError } from '../errors/conflict.error.js';
import { NotFoundError } from '../errors/not-found.error.js';
import { ServiceUnavailableError } from '../errors/service-unavailable.error.js';
import { assertValidImage } from '../image-validation.js';
import { toCatalogItemView, type CatalogItemView } from '../mappers/catalog-item.mapper.js';
import { toPaginatedResponse, type PaginatedResponse } from '../pagination.js';

const IMAGE_FOLDER = 'catalogo';

export interface CatalogListQuery extends PageRequest, DateRange {
  category?: string;
  direction?: CatalogDirection;
  search?: string;
  state?: RecordState | 'ALL';
}

export type CreateCatalogItemInput = Omit<NewCatalogItem, 'note' | 'imageUrl'> & {
  note?: string | null;
};

export type UpdateCatalogItemInput = Partial<CreateCatalogItemInput> & {
  /** Solo se permite restaurar; el borrado se hace con `remove`. */
  state?: 'ACTIVE';
};

export class CatalogUseCase {
  constructor(
    private readonly catalog: ICatalogRepository,
    private readonly files: IFileStorage,
  ) {}

  async list(query: CatalogListQuery, viewer?: AuthenticatedUser): Promise<PaginatedResponse<CatalogItemView>> {
    const { state: requestedState, ...filter } = query;
    const state = viewer?.role === 'admin' ? resolveState(requestedState) : 'ACTIVE';
    const page = await this.catalog.list({ ...filter, ...(state ? { state } : {}) });
    return toPaginatedResponse(page, query, toCatalogItemView);
  }

  async getById(id: string, viewer?: AuthenticatedUser): Promise<CatalogItemView> {
    const item = await this.catalog.findById(id);
    if (!item || (item.state === 'REMOVED' && viewer?.role !== 'admin')) {
      throw new NotFoundError('El numeral no existe.');
    }
    return toCatalogItemView(item);
  }

  async create(input: CreateCatalogItemInput, image?: FileToUpload): Promise<CatalogItemView> {
    if (image) assertValidImage(image);
    await this.assertKeyAvailable({ category: input.category, direction: input.direction, code: input.code });

    const imageUrl = image ? await this.uploadImage(image) : null;
    try {
      const item = await this.catalog.create({ ...input, note: input.note ?? null, imageUrl });
      return toCatalogItemView(item);
    } catch (error) {
      if (imageUrl) await this.files.remove(imageUrl);
      throw error;
    }
  }

  async update(id: string, input: UpdateCatalogItemInput, image?: FileToUpload): Promise<CatalogItemView> {
    assertHasChanges(input, image !== undefined);
    if (image) assertValidImage(image);

    const current = await this.requireItem(id);
    const key: CatalogItemKey = {
      category: input.category ?? current.category,
      direction: input.direction ?? current.direction,
      code: input.code ?? current.code,
    };
    await this.assertKeyAvailable(key, current.id);

    const imageUrl = image ? await this.uploadImage(image) : undefined;
    const changes: CatalogItemChanges = { ...input, ...(imageUrl ? { imageUrl } : {}) };
    try {
      const updated = await this.catalog.update(id, changes);
      if (imageUrl && current.imageUrl) await this.files.remove(current.imageUrl);
      return toCatalogItemView(updated);
    } catch (error) {
      if (imageUrl) await this.files.remove(imageUrl);
      throw error;
    }
  }

  /** Borrado lógico: un ítem ya removido responde 404. */
  async remove(id: string): Promise<void> {
    const item = await this.requireItem(id);
    if (item.state === 'REMOVED') throw new NotFoundError('El numeral no existe.');
    await this.catalog.remove(id);
  }

  private async requireItem(id: string): Promise<CatalogItem> {
    const item = await this.catalog.findById(id);
    if (!item) throw new NotFoundError('El numeral no existe.');
    return item;
  }

  private async assertKeyAvailable(key: CatalogItemKey, ownId?: string): Promise<void> {
    const existing = await this.catalog.findByKey(key);
    if (existing && existing.id !== ownId) {
      throw new ConflictError(
        existing.state === 'REMOVED'
          ? 'Ya existe un numeral con esa categoría, dirección y código, pero está eliminado: restáuralo con state ACTIVE.'
          : 'Ya existe un numeral con esa categoría, dirección y código.',
      );
    }
  }

  private async uploadImage(image: FileToUpload): Promise<string> {
    try {
      return await this.files.upload(image, IMAGE_FOLDER);
    } catch (error) {
      if (error instanceof FileStorageError && error.reason === 'NOT_CONFIGURED') {
        throw new ServiceUnavailableError(
          'La carga de imágenes no está configurada en el servidor.',
          'IMAGE_STORAGE_NOT_CONFIGURED',
        );
      }
      if (error instanceof FileStorageError) {
        throw new BadGatewayError('No se pudo guardar la imagen en el almacenamiento.', 'IMAGE_UPLOAD_FAILED');
      }
      throw error;
    }
  }
}

function resolveState(requested: RecordState | 'ALL' | undefined): RecordState | undefined {
  if (requested === 'ALL') return undefined;
  return requested ?? 'ACTIVE';
}
