import { InteractionType as PrismaInteractionType, type Prisma, type PrismaClient } from '@prisma/client';
import type {
  Interaction,
  InteractionChanges,
  InteractionData,
  InteractionType,
  JsonValue,
  NewInteraction,
} from '../../domain/models/interaction.model.js';
import type { Page } from '../../domain/models/page.model.js';
import type { IInteractionRepository, InteractionFilter } from '../../domain/repository/IInteraction.repository.js';
import { createdAtRange } from './query-helpers.js';

const TYPE_TO_DB: Record<InteractionType, PrismaInteractionType> = {
  'formulario-importaciones': PrismaInteractionType.FORMULARIO_IMPORTACIONES,
  'formulario-exportaciones': PrismaInteractionType.FORMULARIO_EXPORTACIONES,
  'formulario-servicios': PrismaInteractionType.FORMULARIO_SERVICIOS,
  'formulario-inversiones': PrismaInteractionType.FORMULARIO_INVERSIONES,
  'formulario-endeudamiento': PrismaInteractionType.FORMULARIO_ENDEUDAMIENTO,
};

const TYPE_FROM_DB: Record<PrismaInteractionType, InteractionType> = {
  FORMULARIO_IMPORTACIONES: 'formulario-importaciones',
  FORMULARIO_EXPORTACIONES: 'formulario-exportaciones',
  FORMULARIO_SERVICIOS: 'formulario-servicios',
  FORMULARIO_INVERSIONES: 'formulario-inversiones',
  FORMULARIO_ENDEUDAMIENTO: 'formulario-endeudamiento',
};

const include = {
  user: { select: { id: true, name: true, email: true } },
  catalogItem: { select: { id: true, category: true, code: true, title: true } },
} satisfies Prisma.InteractionInclude;

type InteractionRow = Prisma.InteractionGetPayload<{ include: typeof include }>;

function toDomain(row: InteractionRow): Interaction {
  return {
    id: row.id,
    userId: row.userId,
    catalogItemId: row.catalogItemId,
    type: TYPE_FROM_DB[row.type],
    data: toInteractionData(row.data),
    state: row.state,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    user: row.user,
    catalogItem: row.catalogItem,
  };
}

function toInteractionData(value: Prisma.JsonValue): InteractionData {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('La interacción almacenada no contiene un objeto JSON.');
  }
  return value as { [key: string]: JsonValue };
}

export class InteractionPrismaRepository implements IInteractionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(filter: InteractionFilter): Promise<Page<Interaction>> {
    const where: Prisma.InteractionWhereInput = {
      state: 'ACTIVE',
      ...(filter.userId ? { userId: filter.userId } : {}),
      ...(filter.type ? { type: TYPE_TO_DB[filter.type] } : {}),
      ...createdAtRange(filter),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.interaction.count({ where }),
      this.prisma.interaction.findMany({
        where,
        include,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (filter.page - 1) * filter.limit,
        take: filter.limit,
      }),
    ]);
    return { items: rows.map(toDomain), total };
  }

  async findById(id: string): Promise<Interaction | null> {
    const row = await this.prisma.interaction.findFirst({ where: { id, state: 'ACTIVE' }, include });
    return row ? toDomain(row) : null;
  }

  async create(interaction: NewInteraction): Promise<Interaction> {
    const row = await this.prisma.interaction.create({
      data: { ...interaction, type: TYPE_TO_DB[interaction.type] },
      include,
    });
    return toDomain(row);
  }

  async update(id: string, changes: InteractionChanges): Promise<Interaction> {
    const row = await this.prisma.interaction.update({
      where: { id },
      data: { ...changes, type: TYPE_TO_DB[changes.type] },
      include,
    });
    return toDomain(row);
  }

  async remove(id: string): Promise<void> {
    await this.prisma.interaction.update({
      where: { id },
      data: { state: 'REMOVED', deletedAt: new Date() },
    });
  }
}
