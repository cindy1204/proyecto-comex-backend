import type { CatalogRepository } from '../domain/catalog.js';
import type { InteractionOwner, InteractionRepository } from '../domain/interactions.js';
import { ApplicationError } from '../domain/errors.js';
import type { PaginationQuery } from '../domain/pagination.js';

const interactionNumerals = {
  'formulario-importaciones': { category: 'importaciones', field: 'numeralOperacion' },
  'formulario-exportaciones': { category: 'exportaciones', field: 'numeralCambiario' },
} as const;

export type InteractionType = keyof typeof interactionNumerals;

function isInteractionType(type: string): type is InteractionType {
  return type in interactionNumerals;
}

export class InteractionService {
  constructor(
    private readonly catalog: CatalogRepository,
    private readonly interactions: InteractionRepository,
  ) {}

  async create(userId: string, type: InteractionType, data: Record<string, unknown>) {
    const selection = interactionNumerals[type];
    const code = data[selection.field];
    if (typeof code !== 'string' || !code.trim()) {
      throw new ApplicationError(400, 'VALIDATION_ERROR', 'Selecciona un numeral cambiario válido.');
    }

    const item = await this.catalog.findActiveByCategoryAndCode(selection.category, code);
    if (!item) {
      throw new ApplicationError(400, 'VALIDATION_ERROR', 'El numeral no pertenece al catálogo activo.');
    }

    return this.interactions.create({ userId, catalogItemId: item.id, type, data });
  }

  findMine(userId: string, query: PaginationQuery & { type?: string }) {
    return this.interactions.list({ ...query, userId });
  }

  findAll(query: PaginationQuery & { type?: string }) {
    return this.interactions.list(query);
  }

  async findOne(id: string, owner: InteractionOwner) {
    const interaction = await this.getOwnedInteraction(id, owner);
    return interaction;
  }

  async update(
    id: string,
    owner: InteractionOwner,
    input: { type?: InteractionType; data?: Record<string, unknown> },
  ) {
    const existing = await this.getOwnedInteraction(id, owner);
    const type = input.type ?? existing.type;
    if (!isInteractionType(type)) {
      throw new ApplicationError(400, 'VALIDATION_ERROR', 'El tipo de formulario no es válido.');
    }
    const data = { ...existing.data, ...input.data };
    const selection = interactionNumerals[type];
    const code = data[selection.field];
    if (typeof code !== 'string' || !code.trim()) {
      throw new ApplicationError(400, 'VALIDATION_ERROR', 'Selecciona un numeral cambiario válido.');
    }
    const item = await this.catalog.findActiveByCategoryAndCode(selection.category, code);
    if (!item) {
      throw new ApplicationError(400, 'VALIDATION_ERROR', 'El numeral no pertenece al catálogo activo.');
    }

    return this.interactions.update(id, { type, data, catalogItemId: item.id });
  }

  async delete(id: string, owner: InteractionOwner) {
    await this.getOwnedInteraction(id, owner);
    await this.interactions.delete(id);
  }

  private async getOwnedInteraction(id: string, owner: InteractionOwner) {
    const interaction = await this.interactions.findById(id);
    if (!interaction || (owner.role !== 'admin' && interaction.userId !== owner.id)) {
      throw new ApplicationError(404, 'NOT_FOUND', 'La interacción no existe.');
    }
    return interaction;
  }
}
