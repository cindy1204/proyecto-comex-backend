import type { ContactRequest as ContactRequestRow, Prisma, PrismaClient } from '@prisma/client';
import type {
  ContactRequest,
  ContactRequestChanges,
  NewContactRequest,
  ProductType,
} from '../../domain/models/contact-request.model.js';
import type { Page } from '../../domain/models/page.model.js';
import type { ContactFilter, IContactRepository } from '../../domain/repository/IContact.repository.js';
import { createdAtRange } from './query-helpers.js';

function toDomain(row: ContactRequestRow): ContactRequest {
  return {
    id: row.id,
    userId: row.userId,
    nombreCompleto: row.nombreCompleto,
    email: row.email,
    empresa: row.empresa,
    telefono: row.telefono,
    tipoProducto: row.tipoProducto as ProductType,
    descripcionCaso: row.descripcionCaso,
    montoEstimado: row.montoEstimado ? row.montoEstimado.toFixed(2) : null,
    state: row.state,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class ContactPrismaRepository implements IContactRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(filter: ContactFilter): Promise<Page<ContactRequest>> {
    const where: Prisma.ContactRequestWhereInput = {
      state: 'ACTIVE',
      ...(filter.userId ? { userId: filter.userId } : {}),
      ...(filter.tipoProducto ? { tipoProducto: filter.tipoProducto } : {}),
      ...createdAtRange(filter),
      ...(filter.search
        ? {
            OR: [
              { nombreCompleto: { contains: filter.search, mode: 'insensitive' } },
              { email: { contains: filter.search, mode: 'insensitive' } },
              { empresa: { contains: filter.search, mode: 'insensitive' } },
              { descripcionCaso: { contains: filter.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.contactRequest.count({ where }),
      this.prisma.contactRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filter.page - 1) * filter.limit,
        take: filter.limit,
      }),
    ]);
    return { items: rows.map(toDomain), total };
  }

  async findById(id: string): Promise<ContactRequest | null> {
    const row = await this.prisma.contactRequest.findFirst({ where: { id, state: 'ACTIVE' } });
    return row ? toDomain(row) : null;
  }

  async create(request: NewContactRequest): Promise<ContactRequest> {
    return toDomain(await this.prisma.contactRequest.create({ data: request }));
  }

  async update(id: string, changes: ContactRequestChanges): Promise<ContactRequest> {
    return toDomain(await this.prisma.contactRequest.update({ where: { id }, data: changes }));
  }

  async remove(id: string): Promise<void> {
    await this.prisma.contactRequest.update({
      where: { id },
      data: { state: 'REMOVED', deletedAt: new Date() },
    });
  }
}
