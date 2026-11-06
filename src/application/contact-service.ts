import type { ContactRepository, ContactRequestInput } from '../domain/contact.js';
import type { UserRoleName } from '../domain/auth.js';
import type { PaginationQuery } from '../domain/pagination.js';
import { ApplicationError } from '../domain/errors.js';

export class ContactService {
  constructor(private readonly contacts: ContactRepository) {}

  create(input: ContactRequestInput, userId?: string) {
    return this.contacts.create(input, userId);
  }

  findByUser(userId: string, query: PaginationQuery & { tipoProducto?: ContactRequestInput['tipoProducto']; search?: string }) {
    return this.contacts.list({ ...query, userId });
  }

  findAll(query: PaginationQuery & { tipoProducto?: ContactRequestInput['tipoProducto']; search?: string }) {
    return this.contacts.list(query);
  }

  async findOne(id: string, userId: string, role: UserRoleName) {
    return this.getOwnedContact(id, userId, role);
  }

  async update(id: string, userId: string, role: UserRoleName, input: Partial<ContactRequestInput>) {
    await this.getOwnedContact(id, userId, role);
    return this.contacts.update(id, input);
  }

  async delete(id: string, userId: string, role: UserRoleName) {
    await this.getOwnedContact(id, userId, role);
    await this.contacts.delete(id);
  }

  private async getOwnedContact(id: string, userId: string, role: UserRoleName) {
    const contact = await this.contacts.findById(id);
    if (!contact || (role !== 'admin' && contact.userId !== userId)) {
      throw new ApplicationError(404, 'NOT_FOUND', 'La solicitud no existe.');
    }
    return contact;
  }
}
