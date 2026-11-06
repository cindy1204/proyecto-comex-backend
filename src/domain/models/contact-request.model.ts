import type { RecordState } from './record-state.model.js';

export const PRODUCT_TYPES = ['importaciones', 'exportaciones', 'deudaExterna', 'inversiones', 'servicios'] as const;

export type ProductType = (typeof PRODUCT_TYPES)[number];

export interface ContactRequest {
  id: string;
  userId: string | null;
  nombreCompleto: string;
  email: string;
  empresa: string | null;
  telefono: string | null;
  tipoProducto: ProductType;
  descripcionCaso: string;
  /** Monto en USD como cadena decimal con dos cifras (p. ej. "1500.00"). */
  montoEstimado: string | null;
  state: RecordState;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewContactRequest {
  userId: string | null;
  nombreCompleto: string;
  email: string;
  empresa: string | null;
  telefono: string | null;
  tipoProducto: ProductType;
  descripcionCaso: string;
  montoEstimado: string | null;
}

export type ContactRequestChanges = Partial<Omit<NewContactRequest, 'userId'>>;
