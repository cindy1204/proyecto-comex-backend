import { beforeEach, describe, expect, it } from 'vitest';
import { ContactUseCase } from '../../src/application/use-cases/contact.use-case.js';
import type { AuthenticatedUser } from '../../src/domain/models/user.model.js';
import { createInMemoryInfrastructure } from '../support/in-memory.js';

const input = {
  nombreCompleto: 'María Pérez',
  email: 'maria@test.com',
  empresa: null,
  telefono: null,
  tipoProducto: 'importaciones',
  descripcionCaso: 'Necesito asesoría',
  montoEstimado: '1500.00',
} as const;

const owner: AuthenticatedUser = { id: 'cowner', role: 'user' };
const stranger: AuthenticatedUser = { id: 'cstranger', role: 'user' };
const admin: AuthenticatedUser = { id: 'cadmin', role: 'admin' };

describe('ContactUseCase', () => {
  let contacts: ContactUseCase;

  beforeEach(() => {
    contacts = new ContactUseCase(createInMemoryInfrastructure().contacts);
  });

  it('crea una solicitud anónima con userId nulo y el monto como cadena', async () => {
    const created = await contacts.create(input);

    expect(created).toMatchObject({ userId: null, montoEstimado: '1500.00', state: 'ACTIVE' });
  });

  it('asocia la solicitud al usuario autenticado', async () => {
    const created = await contacts.create(input, owner);

    expect(created.userId).toBe(owner.id);
  });

  it('un usuario ajeno recibe 404; el dueño y el administrador acceden', async () => {
    const created = await contacts.create(input, owner);

    await expect(contacts.getById(stranger, created.id)).rejects.toMatchObject({ status: 404 });
    await expect(contacts.getById(owner, created.id)).resolves.toMatchObject({ id: created.id });
    await expect(contacts.getById(admin, created.id)).resolves.toMatchObject({ id: created.id });
  });

  it('el administrador accede a una solicitud anónima y el usuario no', async () => {
    const created = await contacts.create(input);

    await expect(contacts.getById(admin, created.id)).resolves.toBeDefined();
    await expect(contacts.getById(owner, created.id)).rejects.toMatchObject({ status: 404 });
  });

  it('actualiza campos y exige al menos uno', async () => {
    const created = await contacts.create(input, owner);

    const updated = await contacts.update(owner, created.id, { empresa: 'ACME', montoEstimado: null });

    expect(updated).toMatchObject({ empresa: 'ACME', montoEstimado: null });
    await expect(contacts.update(owner, created.id, {})).rejects.toMatchObject({ status: 400 });
  });

  it('el borrado es lógico y deja de aparecer', async () => {
    const created = await contacts.create(input, owner);

    await contacts.remove(owner, created.id);

    await expect(contacts.getById(owner, created.id)).rejects.toMatchObject({ status: 404 });
    expect((await contacts.listMine(owner, { page: 1, limit: 10 })).pagination.total).toBe(0);
  });

  it('lista las propias y el administrador filtra por tipo y búsqueda', async () => {
    await contacts.create(input, owner);
    await contacts.create({ ...input, tipoProducto: 'exportaciones', nombreCompleto: 'Carlos Ruiz' });

    const mine = await contacts.listMine(owner, { page: 1, limit: 10 });
    const byType = await contacts.listAll({ page: 1, limit: 10, tipoProducto: 'exportaciones' });
    const bySearch = await contacts.listAll({ page: 1, limit: 10, search: 'carlos' });

    expect(mine.pagination.total).toBe(1);
    expect(byType.pagination.total).toBe(1);
    expect(bySearch.data[0]).toMatchObject({ nombreCompleto: 'Carlos Ruiz' });
  });
});
