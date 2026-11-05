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
  findByUser(userId: string): Promise<ContactRequestRecord[]>;
  findAll(): Promise<ContactRequestRecord[]>;
}
