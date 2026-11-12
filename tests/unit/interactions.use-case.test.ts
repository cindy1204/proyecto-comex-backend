import { ZodError } from 'zod';
import { beforeEach, describe, expect, it } from 'vitest';
import { InteractionsUseCase } from '../../src/application/use-cases/interactions.use-case.js';
import type { AuthenticatedUser } from '../../src/domain/models/user.model.js';
import { createInMemoryInfrastructure } from '../support/in-memory.js';
import { declarationData, exportData, importData } from '../support/interaction-data.js';

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
    ['un monto usa notación exponencial', { valorFob: '2e3' }],
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

describe('declaraciones de servicios, inversiones y endeudamiento', () => {
  let infra: ReturnType<typeof createInMemoryInfrastructure>;
  let interactions: InteractionsUseCase;
  let owner: AuthenticatedUser;

  beforeEach(async () => {
    infra = createInMemoryInfrastructure();
    interactions = new InteractionsUseCase(infra.catalog, infra.interactions);
    const user = await infra.users.create({ name: 'U', email: 'decl@test.com', passwordHash: 'x', role: 'user' });
    owner = { id: user.id, role: user.role };
    const numerales = [
      { category: 'servicios', direction: 'INGRESOS', code: '1601', title: 'Otros conceptos' },
      { category: 'inversiones', direction: 'INGRESOS', code: '4025', title: 'Inversión' },
      { category: 'endeudamiento', direction: 'INGRESOS', code: '4020', title: 'Crédito' },
      { category: 'importaciones', direction: 'EGRESOS', code: '2010', title: 'Importación' },
      { category: 'exportaciones', direction: 'INGRESOS', code: '1010', title: 'Exportación' },
    ] as const;
    for (const item of numerales) {
      await infra.catalog.create({ ...item, description: 'd', note: null, imageUrl: null });
    }
  });

  it.each([
    ['formulario-servicios', '1601', 'servicios'],
    ['formulario-inversiones', '4025', 'inversiones'],
    ['formulario-endeudamiento', '4020', 'endeudamiento'],
  ] as const)('%s resuelve el numeral desde numeralCambiario dentro de su categoría', async (type, code, category) => {
    const created = await interactions.create(owner, { type, data: declarationData({ numeralCambiario: code }) });

    expect(created.type).toBe(type);
    expect(created.catalogItem).toMatchObject({ category, code });
  });

  it.each([
    ['servicios con un numeral de inversiones', 'formulario-servicios', '4025'],
    ['inversiones con un numeral de exportaciones', 'formulario-inversiones', '1010'],
    ['endeudamiento con un numeral de importaciones', 'formulario-endeudamiento', '2010'],
    ['endeudamiento con un numeral que no existe', 'formulario-endeudamiento', '9999'],
  ] as const)('responde 400 cuando %s', async (_case, type, numeral) => {
    await expect(
      interactions.create(owner, { type, data: declarationData({ numeralCambiario: numeral }) }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it.each([
    ['falta el nombre del titular', { nombreTitular: undefined }],
    ['la tasa no es numérica', { tasaCambioDolares: 'cuatro mil' }],
    ['la moneda no es un código de 3 letras', { monedaNegociacion: 'DOLAR' }],
    ['llega un campo de importaciones', { numeralOperacion: '2010' }],
    ['llega un campo de exportaciones', { totalGastosExportacion: '1' }],
    ['el numeral llega vacío', { numeralCambiario: '   ' }],
  ])('rechaza la declaración de servicios cuando %s', async (_case, overrides) => {
    await expect(
      interactions.create(owner, { type: 'formulario-servicios', data: declarationData(overrides) }),
    ).rejects.toBeInstanceOf(ZodError);
  });

  it('no permite cambiar a otra familia reutilizando los datos de una importación', async () => {
    const created = await interactions.create(owner, { type: 'formulario-importaciones', data: importData() });

    await expect(
      interactions.update(owner, created.id, { type: 'formulario-servicios', data: declarationData() }),
    ).rejects.toBeInstanceOf(ZodError);
  });

  it('actualiza una declaración de inversiones y vuelve a validar su numeral', async () => {
    const created = await interactions.create(owner, {
      type: 'formulario-inversiones',
      data: declarationData({ numeralCambiario: '4025' }),
    });

    await expect(interactions.update(owner, created.id, { data: { numeralCambiario: '1010' } })).rejects.toMatchObject({
      status: 400,
    });
    const changed = await interactions.update(owner, created.id, { data: { tasaCambioDolares: '4100' } });
    expect(changed.data).toMatchObject({ tasaCambioDolares: '4100', numeralCambiario: '4025' });
  });

  it('lista las declaraciones filtradas por tipo', async () => {
    await interactions.create(owner, { type: 'formulario-servicios', data: declarationData() });
    await interactions.create(owner, {
      type: 'formulario-inversiones',
      data: declarationData({ numeralCambiario: '4025' }),
    });

    const services = await interactions.listMine(owner, { page: 1, limit: 10, type: 'formulario-servicios' });
    const investments = await interactions.listMine(owner, { page: 1, limit: 10, type: 'formulario-inversiones' });
    const debts = await interactions.listMine(owner, { page: 1, limit: 10, type: 'formulario-endeudamiento' });

    expect(services.pagination.total).toBe(1);
    expect(investments.pagination.total).toBe(1);
    expect(debts.pagination.total).toBe(0);
  });
});
