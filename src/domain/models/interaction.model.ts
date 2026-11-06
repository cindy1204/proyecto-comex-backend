import type { RecordState } from './record-state.model.js';

export const INTERACTION_TYPES = ['formulario-importaciones', 'formulario-exportaciones'] as const;

export type InteractionType = (typeof INTERACTION_TYPES)[number];

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type InteractionData = { [key: string]: JsonValue };

export interface Interaction {
  id: string;
  userId: string;
  catalogItemId: string;
  type: InteractionType;
  data: InteractionData;
  state: RecordState;
  createdAt: Date;
  updatedAt: Date;
  user: { id: string; name: string; email: string };
  catalogItem: { id: string; category: string; code: string; title: string };
}

export interface NewInteraction {
  userId: string;
  catalogItemId: string;
  type: InteractionType;
  data: InteractionData;
}

export type InteractionChanges = Omit<NewInteraction, 'userId'>;
