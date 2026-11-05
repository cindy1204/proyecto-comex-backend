import type { CatalogRepository } from '../domain/catalog.js';
import type { InteractionRepository } from '../domain/interactions.js';
import { ApplicationError } from '../domain/errors.js';

const interactionNumerals = {
  'formulario-importaciones': { category: 'importaciones', field: 'numeralOperacion' },
  'formulario-exportaciones': { category: 'exportaciones', field: 'numeralCambiario' },
} as const;

export type InteractionType = keyof typeof interactionNumerals;

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

  findMine(userId: string) {
    return this.interactions.findByUser(userId);
  }

  findAll() {
    return this.interactions.findAll();
  }
}
