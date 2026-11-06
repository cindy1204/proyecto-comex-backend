import { CatalogDirection, Prisma } from '@prisma/client';
import type { CatalogFilter, CatalogItemInput, CatalogItemRecord, CatalogItemUpdate, CatalogRepository } from '../domain/catalog.js';
import type { ContactRepository, ContactRequestInput, ContactRequestRecord } from '../domain/contact.js';
import type { InteractionRecord, InteractionRepository } from '../domain/interactions.js';
import { createPagination } from '../domain/pagination.js';
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

    return createPagination(items, total, filter);
  }

  findActiveById(id: string): Promise<CatalogItemRecord | null> {
    return prisma.catalogItem.findFirst({ where: { id, active: true } });
  }

  findById(id: string): Promise<CatalogItemRecord | null> {
    return prisma.catalogItem.findUnique({ where: { id } });
  }

  findActiveByCategoryAndCode(category: string, code: string): Promise<CatalogItemRecord | null> {
    return prisma.catalogItem.findFirst({ where: { category, code, active: true } });
  }

  create(item: CatalogItemInput): Promise<CatalogItemRecord> {
    return prisma.catalogItem.create({ data: item });
  }

  update(id: string, item: CatalogItemUpdate): Promise<CatalogItemRecord> {
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

  async findById(id: string): Promise<InteractionRecord | null> {
    const interaction = await prisma.interaction.findUnique({
      where: { id },
      include: { catalogItem: { select: { id: true, category: true, code: true, title: true } } },
    });
    return interaction ? { ...interaction, data: toJsonObject(interaction.data) } : null;
  }

  async list(filter: { page: number; pageSize: number; userId?: string; type?: string }) {
    const where: Prisma.InteractionWhereInput = {
      ...(filter.userId ? { userId: filter.userId } : {}),
      ...(filter.type ? { type: filter.type } : {}),
    };
    const [total, interactions] = await prisma.$transaction([
      prisma.interaction.count({ where }),
      prisma.interaction.findMany({
        where,
        include: { catalogItem: { select: { id: true, category: true, code: true, title: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
    ]);
    return createPagination(
      interactions.map((interaction) => ({ ...interaction, data: toJsonObject(interaction.data) })),
      total,
      filter,
    );
  }

  async update(id: string, input: { type: string; catalogItemId: string; data: Record<string, unknown> }): Promise<InteractionRecord> {
    const interaction = await prisma.interaction.update({
      where: { id },
      data: { ...input, data: toPrismaJsonObject(input.data) },
      include: { catalogItem: { select: { id: true, category: true, code: true, title: true } } },
    });
    return { ...interaction, data: toJsonObject(interaction.data) };
  }

  async delete(id: string): Promise<void> {
    await prisma.interaction.delete({ where: { id } });
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

  async findById(id: string): Promise<ContactRequestRecord | null> {
    const contact = await prisma.contactRequest.findUnique({ where: { id } });
    return contact ? toContactRequestRecord(contact) : null;
  }

  async list(filter: {
    page: number;
    pageSize: number;
    userId?: string;
    tipoProducto?: ContactRequestInput['tipoProducto'];
    search?: string;
  }) {
    const where: Prisma.ContactRequestWhereInput = {
      ...(filter.userId ? { userId: filter.userId } : {}),
      ...(filter.tipoProducto ? { tipoProducto: filter.tipoProducto } : {}),
      ...(filter.search ? {
        OR: [
          { nombreCompleto: { contains: filter.search, mode: 'insensitive' } },
          { email: { contains: filter.search, mode: 'insensitive' } },
        ],
      } : {}),
    };
    const [total, contacts] = await prisma.$transaction([
      prisma.contactRequest.count({ where }),
      prisma.contactRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
    ]);
    return createPagination(contacts.map(toContactRequestRecord), total, filter);
  }

  async update(id: string, input: Partial<ContactRequestInput>): Promise<ContactRequestRecord> {
    const { descripcionCaso, ...fields } = input;
    const contact = await prisma.contactRequest.update({
      where: { id },
      data: {
        ...(fields.nombreCompleto !== undefined ? { nombreCompleto: fields.nombreCompleto } : {}),
        ...(fields.email !== undefined ? { email: fields.email } : {}),
        ...(fields.empresa !== undefined ? { empresa: fields.empresa || null } : {}),
        ...(fields.telefono !== undefined ? { telefono: fields.telefono || null } : {}),
        ...(fields.tipoProducto !== undefined ? { tipoProducto: fields.tipoProducto } : {}),
        ...(descripcionCaso !== undefined ? { respuestas: { descripcionCaso } } : {}),
      },
    });
    return toContactRequestRecord(contact);
  }

  async delete(id: string): Promise<void> {
    await prisma.contactRequest.delete({ where: { id } });
  }
}

function toContactRequestRecord(contact: {
  id: string;
  userId: string | null;
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
    userId: contact.userId,
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
