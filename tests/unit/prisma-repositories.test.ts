import { Prisma, type PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogPrismaRepository } from '../../src/infrastructure/repository/catalog.prisma.repository.js';
import { ContactPrismaRepository } from '../../src/infrastructure/repository/contact.prisma.repository.js';
import { InteractionPrismaRepository } from '../../src/infrastructure/repository/interaction.prisma.repository.js';
import { UserPrismaRepository } from '../../src/infrastructure/repository/user.prisma.repository.js';

/**
 * Estas pruebas no usan base de datos: un PrismaClient simulado (vi.fn) registra los argumentos que el
 * repositorio envía a Prisma. Verifican la construcción de consultas (filtros, orden, paginación y
 * soft-delete); la ejecución real del SQL queda cubierta solo al probar contra PostgreSQL.
 */
function createModel() {
  return {
    count: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
}

function createFakePrisma() {
  const prisma = {
    catalogItem: createModel(),
    contactRequest: createModel(),
    interaction: createModel(),
    user: createModel(),
    $transaction: vi.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
  };
  return { prisma, client: prisma as unknown as PrismaClient };
}

const NOW = new Date('2026-01-01T00:00:00.000Z');

const catalogRow = {
  id: 'c1',
  category: 'importaciones',
  direction: 'EGRESOS',
  code: '2010',
  title: 'Pago',
  description: 'desc',
  note: null,
  imageUrl: null,
  state: 'ACTIVE',
  deletedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
};

const contactRow = {
  id: 'k1',
  userId: null,
  nombreCompleto: 'Carlos Gómez',
  email: 'carlos@test.com',
  empresa: null,
  telefono: null,
  tipoProducto: 'importaciones',
  descripcionCaso: 'caso',
  montoEstimado: new Prisma.Decimal('1500.5'),
  state: 'ACTIVE',
  deletedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
};

const interactionRow = {
  id: 'i1',
  userId: 'u1',
  catalogItemId: 'c1',
  type: 'FORMULARIO_IMPORTACIONES',
  data: { valorFob: '1' },
  state: 'ACTIVE',
  deletedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
  user: { id: 'u1', name: 'Ana', email: 'ana@test.com' },
  catalogItem: { id: 'c1', category: 'importaciones', code: '2010', title: 'Pago' },
};

describe('CatalogPrismaRepository (PrismaClient simulado)', () => {
  let fake: ReturnType<typeof createFakePrisma>;
  let repository: CatalogPrismaRepository;

  beforeEach(() => {
    fake = createFakePrisma();
    repository = new CatalogPrismaRepository(fake.client);
    fake.prisma.catalogItem.count.mockResolvedValue(25);
    fake.prisma.catalogItem.findMany.mockResolvedValue([catalogRow]);
  });

  it('pagina con skip/take, ordena de forma determinista y devuelve el total', async () => {
    const page = await repository.list({ page: 3, limit: 10, state: 'ACTIVE' });

    expect(fake.prisma.catalogItem.findMany).toHaveBeenCalledWith({
      where: { state: 'ACTIVE' },
      orderBy: [{ category: 'asc' }, { direction: 'asc' }, { code: 'asc' }],
      skip: 20,
      take: 10,
    });
    expect(fake.prisma.catalogItem.count).toHaveBeenCalledWith({ where: { state: 'ACTIVE' } });
    expect(page.total).toBe(25);
    expect(page.items).toHaveLength(1);
  });

  it('aplica categoría, dirección y rango de fechas al conteo y a la página con el mismo where', async () => {
    const createdFrom = new Date('2026-01-01');
    const createdTo = new Date('2026-02-01');

    await repository.list({
      page: 1,
      limit: 5,
      state: 'REMOVED',
      category: 'exportaciones',
      direction: 'INGRESOS',
      createdFrom,
      createdTo,
    });

    const where = {
      state: 'REMOVED',
      category: 'exportaciones',
      direction: 'INGRESOS',
      createdAt: { gte: createdFrom, lte: createdTo },
    };
    expect(fake.prisma.catalogItem.count).toHaveBeenCalledWith({ where });
    expect(fake.prisma.catalogItem.findMany).toHaveBeenCalledWith(expect.objectContaining({ where, skip: 0, take: 5 }));
  });

  it('search busca sin distinguir mayúsculas en código, título y descripción', async () => {
    await repository.list({ page: 1, limit: 10, state: 'ACTIVE', search: 'café' });

    const { where } = fake.prisma.catalogItem.findMany.mock.calls[0]?.[0] as { where: Prisma.CatalogItemWhereInput };
    expect(where.OR).toEqual([
      { code: { contains: 'café', mode: 'insensitive' } },
      { title: { contains: 'café', mode: 'insensitive' } },
      { description: { contains: 'café', mode: 'insensitive' } },
    ]);
    expect(where.state).toBe('ACTIVE');
  });

  it('sin state no filtra por estado (admin con state=ALL) y sin search no agrega OR', async () => {
    await repository.list({ page: 1, limit: 10 });

    const { where } = fake.prisma.catalogItem.findMany.mock.calls[0]?.[0] as { where: object };
    expect(where).toEqual({});
  });

  it('findById no filtra por estado: el caso de uso decide quién ve un numeral eliminado', async () => {
    fake.prisma.catalogItem.findUnique.mockResolvedValue({ ...catalogRow, state: 'REMOVED' });

    const item = await repository.findById('c1');

    expect(fake.prisma.catalogItem.findUnique).toHaveBeenCalledWith({ where: { id: 'c1' } });
    expect(item?.state).toBe('REMOVED');
  });

  it('findByKey busca por la clave única compuesta, incluidos los eliminados', async () => {
    fake.prisma.catalogItem.findUnique.mockResolvedValue(null);

    await expect(
      repository.findByKey({ category: 'importaciones', direction: 'EGRESOS', code: '2010' }),
    ).resolves.toBeNull();

    expect(fake.prisma.catalogItem.findUnique).toHaveBeenCalledWith({
      where: { category_direction_code: { category: 'importaciones', direction: 'EGRESOS', code: '2010' } },
    });
  });

  it('findActiveByCategoryAndCode solo considera numerales activos', async () => {
    fake.prisma.catalogItem.findFirst.mockResolvedValue(null);

    await repository.findActiveByCategoryAndCode('importaciones', '2010');

    expect(fake.prisma.catalogItem.findFirst).toHaveBeenCalledWith({
      where: { category: 'importaciones', code: '2010', state: 'ACTIVE' },
    });
  });

  it('restaurar (state ACTIVE) limpia deletedAt', async () => {
    fake.prisma.catalogItem.update.mockResolvedValue(catalogRow);

    await repository.update('c1', { state: 'ACTIVE' });

    expect(fake.prisma.catalogItem.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { state: 'ACTIVE', deletedAt: null },
    });
  });

  it('una actualización normal no toca deletedAt', async () => {
    fake.prisma.catalogItem.update.mockResolvedValue(catalogRow);

    await repository.update('c1', { title: 'Nuevo' });

    expect(fake.prisma.catalogItem.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { title: 'Nuevo' } });
  });

  it('remove hace borrado lógico: state REMOVED y deletedAt con fecha, sin delete físico', async () => {
    fake.prisma.catalogItem.update.mockResolvedValue(catalogRow);

    await repository.remove('c1');

    expect(fake.prisma.catalogItem.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { state: 'REMOVED', deletedAt: expect.any(Date) },
    });
  });
});

describe('ContactPrismaRepository (PrismaClient simulado)', () => {
  let fake: ReturnType<typeof createFakePrisma>;
  let repository: ContactPrismaRepository;

  beforeEach(() => {
    fake = createFakePrisma();
    repository = new ContactPrismaRepository(fake.client);
    fake.prisma.contactRequest.count.mockResolvedValue(1);
    fake.prisma.contactRequest.findMany.mockResolvedValue([contactRow]);
  });

  it('lista solo solicitudes activas, con orden determinista, skip y take', async () => {
    const page = await repository.list({ page: 2, limit: 15 });

    expect(fake.prisma.contactRequest.findMany).toHaveBeenCalledWith({
      where: { state: 'ACTIVE' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: 15,
      take: 15,
    });
    expect(page.items[0]?.montoEstimado).toBe('1500.50');
  });

  it('combina usuario, tipo de producto, fechas y search (insensible a mayúsculas) sobre el estado activo', async () => {
    const createdFrom = new Date('2026-01-01');

    await repository.list({
      page: 1,
      limit: 10,
      userId: 'u1',
      tipoProducto: 'exportaciones',
      createdFrom,
      search: 'carlos',
    });

    const expected = {
      state: 'ACTIVE',
      userId: 'u1',
      tipoProducto: 'exportaciones',
      createdAt: { gte: createdFrom },
      OR: [
        { nombreCompleto: { contains: 'carlos', mode: 'insensitive' } },
        { email: { contains: 'carlos', mode: 'insensitive' } },
        { empresa: { contains: 'carlos', mode: 'insensitive' } },
        { descripcionCaso: { contains: 'carlos', mode: 'insensitive' } },
      ],
    };
    expect(fake.prisma.contactRequest.count).toHaveBeenCalledWith({ where: expected });
    expect(fake.prisma.contactRequest.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expected }));
  });

  it('findById ignora las solicitudes eliminadas', async () => {
    fake.prisma.contactRequest.findFirst.mockResolvedValue(null);

    await expect(repository.findById('k1')).resolves.toBeNull();

    expect(fake.prisma.contactRequest.findFirst).toHaveBeenCalledWith({ where: { id: 'k1', state: 'ACTIVE' } });
  });

  it('remove marca REMOVED con deletedAt en lugar de borrar', async () => {
    fake.prisma.contactRequest.update.mockResolvedValue(contactRow);

    await repository.remove('k1');

    expect(fake.prisma.contactRequest.update).toHaveBeenCalledWith({
      where: { id: 'k1' },
      data: { state: 'REMOVED', deletedAt: expect.any(Date) },
    });
  });
});

describe('InteractionPrismaRepository (PrismaClient simulado)', () => {
  let fake: ReturnType<typeof createFakePrisma>;
  let repository: InteractionPrismaRepository;

  beforeEach(() => {
    fake = createFakePrisma();
    repository = new InteractionPrismaRepository(fake.client);
    fake.prisma.interaction.count.mockResolvedValue(1);
    fake.prisma.interaction.findMany.mockResolvedValue([interactionRow]);
  });

  it('lista solo activas, con filtros, orden determinista, skip/take e include de usuario y numeral', async () => {
    const createdTo = new Date('2026-03-01');

    const page = await repository.list({
      page: 2,
      limit: 5,
      userId: 'u1',
      type: 'formulario-exportaciones',
      createdTo,
    });

    const where = {
      state: 'ACTIVE',
      userId: 'u1',
      type: 'FORMULARIO_EXPORTACIONES',
      createdAt: { lte: createdTo },
    };
    expect(fake.prisma.interaction.count).toHaveBeenCalledWith({ where });
    expect(fake.prisma.interaction.findMany).toHaveBeenCalledWith({
      where,
      include: expect.objectContaining({ user: expect.anything(), catalogItem: expect.anything() }),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: 5,
      take: 5,
    });
    expect(page.items[0]).toMatchObject({ id: 'i1', type: 'formulario-importaciones' });
  });

  it.each([
    ['formulario-servicios', 'FORMULARIO_SERVICIOS'],
    ['formulario-inversiones', 'FORMULARIO_INVERSIONES'],
    ['formulario-endeudamiento', 'FORMULARIO_ENDEUDAMIENTO'],
  ] as const)('filtra %s con su valor del enum de base de datos', async (type, dbType) => {
    await repository.list({ page: 1, limit: 5, type });

    expect(fake.prisma.interaction.count).toHaveBeenLastCalledWith({
      where: expect.objectContaining({ type: dbType }),
    });
  });

  it('findById ignora las interacciones eliminadas', async () => {
    fake.prisma.interaction.findFirst.mockResolvedValue(null);

    await expect(repository.findById('i1')).resolves.toBeNull();

    expect(fake.prisma.interaction.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'i1', state: 'ACTIVE' } }),
    );
  });

  it('remove marca REMOVED con deletedAt en lugar de borrar', async () => {
    fake.prisma.interaction.update.mockResolvedValue(interactionRow);

    await repository.remove('i1');

    expect(fake.prisma.interaction.update).toHaveBeenCalledWith({
      where: { id: 'i1' },
      data: { state: 'REMOVED', deletedAt: expect.any(Date) },
    });
  });

  it('rechaza datos almacenados que no son un objeto JSON', async () => {
    fake.prisma.interaction.findFirst.mockResolvedValue({ ...interactionRow, data: [1, 2] });

    await expect(repository.findById('i1')).rejects.toBeInstanceOf(TypeError);
  });
});

describe('UserPrismaRepository (PrismaClient simulado)', () => {
  it('traduce el rol del dominio al enum de la base y de vuelta', async () => {
    const fake = createFakePrisma();
    fake.prisma.user.create.mockResolvedValue({
      id: 'u1',
      name: 'Root',
      email: 'root@test.com',
      passwordHash: 'h',
      role: 'ADMIN',
      createdAt: NOW,
    });

    const user = await new UserPrismaRepository(fake.client).create({
      name: 'Root',
      email: 'root@test.com',
      passwordHash: 'h',
      role: 'admin',
    });

    expect(fake.prisma.user.create).toHaveBeenCalledWith({
      data: { name: 'Root', email: 'root@test.com', passwordHash: 'h', role: 'ADMIN' },
    });
    expect(user.role).toBe('admin');
  });
});
