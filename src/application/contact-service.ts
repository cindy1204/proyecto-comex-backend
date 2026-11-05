import type { ContactRepository, ContactRequestInput } from '../domain/contact.js';

export class ContactService {
  constructor(private readonly contacts: ContactRepository) {}

  create(input: ContactRequestInput, userId?: string) {
    return this.contacts.create(input, userId);
  }

  findByUser(userId: string) {
    return this.contacts.findByUser(userId);
  }

  findAll() {
    return this.contacts.findAll();
  }
}
