import type { DateRange, PageRequest } from '../../domain/models/page.model.js';
import type { InteractionData, InteractionType } from '../../domain/models/interaction.model.js';
import type { AuthenticatedUser } from '../../domain/models/user.model.js';
import type { ICatalogRepository } from '../../domain/repository/ICatalog.repository.js';
import type { IInteractionRepository } from '../../domain/repository/IInteraction.repository.js';
import { isOwnerOrAdmin } from '../access.js';
import { parseInteractionData } from '../interaction-data.js';
import { assertHasChanges } from '../assert-has-changes.js';
import { BadRequestError } from '../errors/bad-request.error.js';
import { NotFoundError } from '../errors/not-found.error.js';
import { toInteractionView, type InteractionView } from '../mappers/interaction.mapper.js';
import { toPaginatedResponse, type PaginatedResponse } from '../pagination.js';

const NUMERAL_SELECTION = {
  'formulario-importaciones': { category: 'importaciones', field: 'numeralOperacion' },
  'formulario-exportaciones': { category: 'exportaciones', field: 'numeralCambiario' },
} as const;

export interface InteractionListQuery extends PageRequest, DateRange {
  type?: InteractionType;
  userId?: string;
}

export interface CreateInteractionInput {
  type: InteractionType;
  data: InteractionData;
}

export type UpdateInteractionInput = Partial<CreateInteractionInput>;

export class InteractionsUseCase {
  constructor(
    private readonly catalog: ICatalogRepository,
    private readonly interactions: IInteractionRepository,
  ) {}

  async create(viewer: AuthenticatedUser, input: CreateInteractionInput): Promise<InteractionView> {
    const data = parseInteractionData(input.type, input.data);
    const catalogItemId = await this.resolveNumeral(input.type, data);
    const interaction = await this.interactions.create({
      userId: viewer.id,
      catalogItemId,
      type: input.type,
      data,
    });
    return toInteractionView(interaction, viewer.role === 'admin');
  }

  /** Listado global; la autorización de administrador se aplica en el router. */
  async listAll(viewer: AuthenticatedUser, query: InteractionListQuery): Promise<PaginatedResponse<InteractionView>> {
    const page = await this.interactions.list(query);
    return toPaginatedResponse(page, query, (item) => toInteractionView(item, viewer.role === 'admin'));
  }

  async listMine(
    viewer: AuthenticatedUser,
    query: Omit<InteractionListQuery, 'userId'>,
  ): Promise<PaginatedResponse<InteractionView>> {
    const page = await this.interactions.list({ ...query, userId: viewer.id });
    return toPaginatedResponse(page, query, (item) => toInteractionView(item, viewer.role === 'admin'));
  }

  async getById(viewer: AuthenticatedUser, id: string): Promise<InteractionView> {
    const interaction = await this.requireAccessible(viewer, id);
    return toInteractionView(interaction, viewer.role === 'admin');
  }

  async update(viewer: AuthenticatedUser, id: string, input: UpdateInteractionInput): Promise<InteractionView> {
    assertHasChanges(input);
    const existing = await this.requireAccessible(viewer, id);
    const type = input.type ?? existing.type;
    const data = parseInteractionData(type, { ...existing.data, ...input.data });
    const catalogItemId = await this.resolveNumeral(type, data);

    const updated = await this.interactions.update(id, { type, data, catalogItemId });
    return toInteractionView(updated, viewer.role === 'admin');
  }

  async remove(viewer: AuthenticatedUser, id: string): Promise<void> {
    await this.requireAccessible(viewer, id);
    await this.interactions.remove(id);
  }

  /** Cada tipo de formulario referencia un numeral activo de su categoría. */
  private async resolveNumeral(type: InteractionType, data: InteractionData): Promise<string> {
    const selection = NUMERAL_SELECTION[type];
    const code = data[selection.field];
    if (typeof code !== 'string' || !code.trim()) {
      throw new BadRequestError('Selecciona un numeral cambiario válido.');
    }
    const item = await this.catalog.findActiveByCategoryAndCode(selection.category, code);
    if (!item) {
      throw new BadRequestError('El numeral no pertenece al catálogo activo.');
    }
    return item.id;
  }

  private async requireAccessible(viewer: AuthenticatedUser, id: string) {
    const interaction = await this.interactions.findById(id);
    if (!interaction || !isOwnerOrAdmin(viewer, interaction.userId)) {
      throw new NotFoundError('La interacción no existe.');
    }
    return interaction;
  }
}
