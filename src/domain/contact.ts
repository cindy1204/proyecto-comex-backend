import type { PaginatedResult, PaginationQuery } from './pagination.js';

export type ContactProduct = 'importaciones' | 'exportaciones' | 'deudaExterna' | 'inversiones' | 'servicios';

export interface ContactRequestInput {
  nombreCompleto: string;
  email: string;
  empresa: string;
  telefono: string;
  tipoProducto: ContactProduct;
  descripcionCaso: string;
}

export interface ContactRequestRecord {
  id: string;
  userId: string | null;
  nombreCompleto: string;
  email: string;
  empresa: string | null;
  telefono: string | null;
  tipoProducto: ContactProduct;
  descripcionCaso: string;
  createdAt: Date;
}

export interface ContactRepository {
  create(input: ContactRequestInput, userId?: string): Promise<{ id: string; createdAt: Date }>;
  findById(id: string): Promise<ContactRequestRecord | null>;
  list(filter: PaginationQuery & { userId?: string; tipoProducto?: ContactProduct; search?: string }): Promise<PaginatedResult<ContactRequestRecord>>;
  update(id: string, input: Partial<ContactRequestInput>): Promise<ContactRequestRecord>;
  delete(id: string): Promise<void>;
}
