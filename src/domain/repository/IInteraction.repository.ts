import type { Interaction, InteractionChanges, InteractionType, NewInteraction } from '../models/interaction.model.js';
import type { DateRange, Page, PageRequest } from '../models/page.model.js';

export interface InteractionFilter extends PageRequest, DateRange {
  userId?: string;
  type?: InteractionType;
}

export interface IInteractionRepository {
  list(filter: InteractionFilter): Promise<Page<Interaction>>;
  /** Devuelve solo interacciones activas. */
  findById(id: string): Promise<Interaction | null>;
  create(interaction: NewInteraction): Promise<Interaction>;
  update(id: string, changes: InteractionChanges): Promise<Interaction>;
  remove(id: string): Promise<void>;
}
