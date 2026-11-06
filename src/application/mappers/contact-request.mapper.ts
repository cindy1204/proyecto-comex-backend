import type { ContactRequest } from '../../domain/models/contact-request.model.js';

export type ContactRequestView = ContactRequest;

export function toContactRequestView(request: ContactRequest): ContactRequestView {
  return {
    id: request.id,
    userId: request.userId,
    nombreCompleto: request.nombreCompleto,
    email: request.email,
    empresa: request.empresa,
    telefono: request.telefono,
    tipoProducto: request.tipoProducto,
    descripcionCaso: request.descripcionCaso,
    montoEstimado: request.montoEstimado,
    state: request.state,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  };
}
