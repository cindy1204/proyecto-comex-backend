import type { Interaction, InteractionData, InteractionType } from '../../domain/models/interaction.model.js';
import type { RecordState } from '../../domain/models/record-state.model.js';

export interface InteractionView {
  id: string;
  userId: string;
  catalogItemId: string;
  type: InteractionType;
  data: InteractionData;
  state: RecordState;
  createdAt: Date;
  updatedAt: Date;
  user?: Interaction['user'];
  catalogItem: Interaction['catalogItem'];
}

/** El usuario solo se expone a los administradores. */
export function toInteractionView(interaction: Interaction, includeUser: boolean): InteractionView {
  return {
    id: interaction.id,
    userId: interaction.userId,
    catalogItemId: interaction.catalogItemId,
    type: interaction.type,
    data: interaction.data,
    state: interaction.state,
    createdAt: interaction.createdAt,
    updatedAt: interaction.updatedAt,
    ...(includeUser ? { user: interaction.user } : {}),
    catalogItem: interaction.catalogItem,
  };
}
