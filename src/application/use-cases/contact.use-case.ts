import type {
  ContactRequestChanges,
  NewContactRequest,
  ProductType,
} from '../../domain/models/contact-request.model.js';
import type { DateRange, PageRequest } from '../../domain/models/page.model.js';
import type { AuthenticatedUser } from '../../domain/models/user.model.js';
import type { IContactRepository } from '../../domain/repository/IContact.repository.js';
import { isOwnerOrAdmin } from '../access.js';
import { assertHasChanges } from '../assert-has-changes.js';
import { NotFoundError } from '../errors/not-found.error.js';
import { toContactRequestView, type ContactRequestView } from '../mappers/contact-request.mapper.js';
import { toPaginatedResponse, type PaginatedResponse } from '../pagination.js';

export interface ContactListQuery extends PageRequest, DateRange {
  tipoProducto?: ProductType;
  search?: string;
}

export type CreateContactInput = Omit<NewContactRequest, 'userId'>;

export class ContactUseCase {
  constructor(private readonly contacts: IContactRepository) {}

  /** Si hay una sesión válida la solicitud queda asociada al usuario; si no, es anónima. */
  async create(input: CreateContactInput, viewer?: AuthenticatedUser): Promise<ContactRequestView> {
    const request = await this.contacts.create({ ...input, userId: viewer?.id ?? null });
    return toContactRequestView(request);
  }

  /** Listado global; la autorización de administrador se aplica en el router. */
  async listAll(query: ContactListQuery): Promise<PaginatedResponse<ContactRequestView>> {
    const page = await this.contacts.list(query);
    return toPaginatedResponse(page, query, toContactRequestView);
  }

  async listMine(viewer: AuthenticatedUser, query: ContactListQuery): Promise<PaginatedResponse<ContactRequestView>> {
    const page = await this.contacts.list({ ...query, userId: viewer.id });
    return toPaginatedResponse(page, query, toContactRequestView);
  }

  async getById(viewer: AuthenticatedUser, id: string): Promise<ContactRequestView> {
    return toContactRequestView(await this.requireAccessible(viewer, id));
  }

  async update(viewer: AuthenticatedUser, id: string, changes: ContactRequestChanges): Promise<ContactRequestView> {
    assertHasChanges(changes);
    await this.requireAccessible(viewer, id);
    return toContactRequestView(await this.contacts.update(id, changes));
  }

  async remove(viewer: AuthenticatedUser, id: string): Promise<void> {
    await this.requireAccessible(viewer, id);
    await this.contacts.remove(id);
  }

  private async requireAccessible(viewer: AuthenticatedUser, id: string) {
    const request = await this.contacts.findById(id);
    if (!request || !isOwnerOrAdmin(viewer, request.userId)) {
      throw new NotFoundError('La solicitud de contacto no existe.');
    }
    return request;
  }
}
