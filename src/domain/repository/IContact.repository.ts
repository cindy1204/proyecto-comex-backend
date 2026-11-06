import type {
  ContactRequest,
  ContactRequestChanges,
  NewContactRequest,
  ProductType,
} from '../models/contact-request.model.js';
import type { DateRange, Page, PageRequest } from '../models/page.model.js';

export interface ContactFilter extends PageRequest, DateRange {
  userId?: string;
  tipoProducto?: ProductType;
  search?: string;
}

export interface IContactRepository {
  list(filter: ContactFilter): Promise<Page<ContactRequest>>;
  /** Devuelve solo solicitudes activas. */
  findById(id: string): Promise<ContactRequest | null>;
  create(request: NewContactRequest): Promise<ContactRequest>;
  update(id: string, changes: ContactRequestChanges): Promise<ContactRequest>;
  remove(id: string): Promise<void>;
}
