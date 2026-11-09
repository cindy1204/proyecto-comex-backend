import { ZodError } from 'zod';
import { beforeEach, describe, expect, it } from 'vitest';
import { InteractionsUseCase } from '../../src/application/use-cases/interactions.use-case.js';
import type { AuthenticatedUser } from '../../src/domain/models/user.model.js';
import { createInMemoryInfrastructure } from '../support/in-memory.js';
import { exportData, importData } from '../support/interaction-data.js';

describe('InteractionsUseCase', () => {
  let infra: ReturnType<typeof createInMemoryInfrastructure>;
  let interactions: InteractionsUseCase;
  let owner: AuthenticatedUser;
  let other: AuthenticatedUser;
  let admin: AuthenticatedUser;

  beforeEach(async () => {
    infra = createInMemoryInfrastructure();
    interactions = new InteractionsUseCase(infra.catalog, infra.interactions);
    const [a, b, c] = await Promise.all(
      (['user', 'user', 'admin'] as const).map((role, index) =>
        infra.users.create({ name: `U${index}`, email: `u${index}@test.com`, passwordHash: 'x', role }),
      ),
    );
    if (!a || !b || !c) throw new Error('usuarios de prueba');
    owner = { id: a.id, role: a.role };
    other = { id: b.id, role: b.role };
    admin = { id: c.id, role: c.role };
    await infra.catalog.create({
      category: 'importaciones',
      direction: 'EGRESOS',
      code: '2010',
      title: 'Importación',
      description: 'd',
      note: null,
      imageUrl: null,
    });
    await infra.catalog.create({
      category: 'exportaciones',
      direction: 'INGRESOS',
      code: '1010',
      title: 'Exportación',
      description: 'd',
      note: null,
      imageUrl: null,
    });
  });

  const importacion = { type: 'formulario-importaciones', data: importData() } as const;

  it('resuelve el numeral de importaciones desde numeralOperacion', async () => {
    const created = await interactions.create(owner, importacion);

    expect(created.catalogItem).toMatchObject({ category: 'importaciones', code: '2010' });
    expect(created.userId).toBe(owner.id);
    expect(created).not.toHaveProperty('user');
  });

  it('resuelve el numeral de exportaciones desde numeralCambiario', async () => {
    const created = await interactions.create(owner, {
      type: 'formulario-exportaciones',
      data: exportData(),
    });

    expect(created.catalogItem).toMatchObject({ category: 'exportaciones', code: '1010' });
  });

  it.each([
    ['el numeral no existe', { numeralOperacion: '9999' }],
    ['el numeral es de otra categoría', { numeralOperacion: '1010' }],
  ])('responde 400 cuando %s', async (_case, overrides) => {
    await expect(
      interactions.create(owner, { type: 'formulario-importaciones', data: importData(overrides) }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it.each([
    ['falta un campo obligatorio', { nombreImportador: undefined }],
    ['un monto no es numérico', { valorFob: 'abc' }],
    ['la moneda no es un código de 3 letras', { monedaNegociacion: 'DOLAR' }],
    ['llega un campo desconocido', { extra: 'x' }],
  ])('rechaza el formulario cuando %s', async (_case, overrides) => {
    await expect(
      interactions.create(owner, { type: 'formulario-importaciones', data: importData(overrides) }),
    ).rejects.toBeInstanceOf(ZodError);
  });

  it('incluye el usuario solo para administradores', async () => {
    const created = await interactions.create(owner, importacion);

    const asAdmin = await interactions.getById(admin, created.id);

    expect(asAdmin.user).toMatchObject({ id: owner.id });
  });

  it('un usuario ajeno recibe 404 al leer, editar o borrar', async () => {
    const created = await interactions.create(owner, importacion);

    await expect(interactions.getById(other, created.id)).rejects.toMatchObject({ status: 404 });
    await expect(interactions.update(other, created.id, { data: { valorFob: '1' } })).rejects.toMatchObject({
      status: 404,
    });
    await expect(interactions.remove(other, created.id)).rejects.toMatchObject({ status: 404 });
  });

  it('el borrado es lógico: luego no se encuentra ni se lista', async () => {
    const created = await interactions.create(owner, importacion);

    await interactions.remove(owner, created.id);

    await expect(interactions.getById(owner, created.id)).rejects.toMatchObject({ status: 404 });
    const mine = await interactions.listMine(owner, { page: 1, limit: 10 });
    expect(mine.pagination.total).toBe(0);
  });

  it('actualiza mezclando data y volviendo a validar el numeral', async () => {
    const created = await interactions.create(owner, importacion);

    const updated = await interactions.update(owner, created.id, { data: { valorFob: '99' } });

    expect(updated.data).toEqual(importData({ valorFob: '99', observaciones: '' }));
    await expect(interactions.update(owner, created.id, { data: { numeralOperacion: '0000' } })).rejects.toMatchObject({
      status: 400,
    });
  });

  it('exige al menos un cambio', async () => {
    const created = await interactions.create(owner, importacion);

    await expect(interactions.update(owner, created.id, {})).rejects.toMatchObject({ status: 400 });
  });

  it('lista las propias, y el administrador filtra por usuario y tipo', async () => {
    await interactions.create(owner, importacion);
    await interactions.create(other, importacion);
    await interactions.create(owner, { type: 'formulario-exportaciones', data: exportData() });

    const mine = await interactions.listMine(owner, { page: 1, limit: 10 });
    const mineByType = await interactions.listMine(owner, { page: 1, limit: 10, type: 'formulario-exportaciones' });
    const all = await interactions.listAll(admin, { page: 1, limit: 10 });
    const byUser = await interactions.listAll(admin, { page: 1, limit: 10, userId: other.id });

    expect(mine.pagination.total).toBe(2);
    expect(mineByType.pagination.total).toBe(1);
    expect(all.pagination.total).toBe(3);
    expect(byUser.pagination.total).toBe(1);
  });
});
