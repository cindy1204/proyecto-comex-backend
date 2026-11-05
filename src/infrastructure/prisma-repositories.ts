import { CatalogDirection, Prisma, UserRole } from '@prisma/client';
import type { CatalogFilter, CatalogItemInput, CatalogItemRecord, CatalogRepository } from '../domain/catalog.js';
import type { ContactRepository, ContactRequestInput, ContactRequestRecord } from '../domain/contact.js';
import type { InteractionRecord, InteractionRepository } from '../domain/interactions.js';
import { prisma } from './prisma-client.js';

export class PrismaCatalogRepository implements CatalogRepository {
  async list(filter: CatalogFilter) {
    const where: Prisma.CatalogItemWhereInput = {
      active: true,
      ...(filter.category ? { category: filter.category } : {}),
      ...(filter.direction
        ? { direction: filter.direction === 'INGRESOS' ? CatalogDirection.INGRESOS : CatalogDirection.EGRESOS }
        : {}),
      ...(filter.search
        ? {
            OR: [
              { code: { contains: filter.search, mode: 'insensitive' } },
              { title: { contains: filter.search, mode: 'insensitive' } },
              { description: { contains: filter.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [total, items] = await prisma.$transaction([
      prisma.catalogItem.count({ where }),
      prisma.catalogItem.findMany({
        where,
        orderBy: [{ category: 'asc' }, { code: 'asc' }],
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
    ]);

    return {
      pagination: {
        page: filter.page,
        pageSize: filter.pageSize,
        total,
        totalPages: Math.ceil(total / filter.pageSize),
      },
      data: items,
    };
  }

  findActiveById(id: string): Promise<CatalogItemRecord | null> {
    return prisma.catalogItem.findFirst({ where: { id, active: true } });
  }

  findActiveByCategoryAndCode(category: string, code: string): Promise<CatalogItemRecord | null> {
    return prisma.catalogItem.findFirst({ where: { category, code, active: true } });
  }

  create(item: CatalogItemInput): Promise<CatalogItemRecord> {
    return prisma.catalogItem.create({ data: item });
  }

  update(id: string, item: Partial<CatalogItemInput>): Promise<CatalogItemRecord> {
    return prisma.catalogItem.update({ where: { id }, data: item });
  }

  async deactivate(id: string): Promise<void> {
    await prisma.catalogItem.update({ where: { id }, data: { active: false } });
  }
}

export class PrismaInteractionRepository implements InteractionRepository {
  async create(input: {
    userId: string;
    catalogItemId: string;
    type: string;
    data: Record<string, unknown>;
  }): Promise<InteractionRecord> {
    const interaction = await prisma.interaction.create({
      data: {
        ...input,
        data: toPrismaJsonObject(input.data),
      },
      include: { catalogItem: { select: { id: true, category: true, code: true, title: true } } },
    });
    return { ...interaction, data: toJsonObject(interaction.data) };
  }

  async findByUser(userId: string): Promise<InteractionRecord[]> {
    const interactions = await prisma.interaction.findMany({
      where: { userId },
      include: { catalogItem: { select: { id: true, category: true, code: true, title: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return interactions.map((interaction) => ({ ...interaction, data: toJsonObject(interaction.data) }));
  }

  async findAll(): Promise<InteractionRecord[]> {
    const interactions = await prisma.interaction.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        catalogItem: { select: { id: true, category: true, code: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return interactions.map((interaction) => ({ ...interaction, data: toJsonObject(interaction.data) }));
  }
}

export class PrismaContactRepository implements ContactRepository {
  create(input: ContactRequestInput, userId?: string): Promise<{ id: string; createdAt: Date }> {
    return prisma.contactRequest.create({
      data: {
        userId: userId ?? null,
        nombreCompleto: input.nombreCompleto,
        email: input.email,
        empresa: input.empresa || null,
        telefono: input.telefono || null,
        tipoProducto: input.tipoProducto,
        respuestas: { descripcionCaso: input.descripcionCaso },
      },
      select: { id: true, createdAt: true },
    });
  }

  async findByUser(userId: string): Promise<ContactRequestRecord[]> {
    const contacts = await prisma.contactRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return contacts.map(toContactRequestRecord);
  }

  async findAll(): Promise<ContactRequestRecord[]> {
    const contacts = await prisma.contactRequest.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return contacts.map(toContactRequestRecord);
  }
}

function toContactRequestRecord(contact: {
  id: string;
  nombreCompleto: string;
  email: string;
  empresa: string | null;
  telefono: string | null;
  tipoProducto: string;
  respuestas: Prisma.JsonValue;
  createdAt: Date;
}): ContactRequestRecord {
  return {
    id: contact.id,
    nombreCompleto: contact.nombreCompleto,
    email: contact.email,
    empresa: contact.empresa,
    telefono: contact.telefono,
    tipoProducto: contact.tipoProducto as ContactRequestRecord['tipoProducto'],
    descripcionCaso: readContactDescription(contact.respuestas),
    createdAt: contact.createdAt,
  };
}

function readContactDescription(value: Prisma.JsonValue): string {
  if (
    typeof value !== 'object'
    || value === null
    || Array.isArray(value)
    || typeof value.descripcionCaso !== 'string'
  ) {
    throw new TypeError('La solicitud de contacto almacenada no contiene una descripción válida.');
  }
  return value.descripcionCaso;
}

function toPrismaJsonObject(value: object): Prisma.InputJsonObject {
  const entries = Object.entries(value).map(
    ([key, item]): [string, Prisma.InputJsonValue | null] => [key, toPrismaJsonValue(item)],
  );
  return Object.fromEntries(entries);
}

function toPrismaJsonValue(value: unknown): Prisma.InputJsonValue | null {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(toPrismaJsonValue);
  }
  if (typeof value === 'object') {
    return toPrismaJsonObject(value);
  }
  throw new TypeError('Los datos de interacción contienen un valor JSON no compatible.');
}

function toJsonObject(value: Prisma.JsonValue): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('La interacción almacenada no contiene un objeto JSON.');
  }
  return value;
}
