import { randomBytes } from 'node:crypto';
import type {
  CatalogItem,
  CatalogItemChanges,
  CatalogItemKey,
  NewCatalogItem,
} from '../../src/domain/models/catalog-item.model.js';
import type {
  ContactRequest,
  ContactRequestChanges,
  NewContactRequest,
} from '../../src/domain/models/contact-request.model.js';
import type { Interaction, InteractionChanges, NewInteraction } from '../../src/domain/models/interaction.model.js';
import type { DateRange, Page, PageRequest } from '../../src/domain/models/page.model.js';
import type { AuthenticatedUser, NewUser, User } from '../../src/domain/models/user.model.js';
import type { CatalogFilter, ICatalogRepository } from '../../src/domain/repository/ICatalog.repository.js';
import type { ContactFilter, IContactRepository } from '../../src/domain/repository/IContact.repository.js';
import type { IInteractionRepository, InteractionFilter } from '../../src/domain/repository/IInteraction.repository.js';
import type { IUserRepository } from '../../src/domain/repository/IUser.repository.js';
import { FileStorageError, type FileToUpload, type IFileStorage } from '../../src/domain/services/IFileStorage.js';
import type { IPasswordHasher } from '../../src/domain/services/IPasswordHasher.js';
import type { ITokenService } from '../../src/domain/services/ITokenService.js';

/** Identificador con forma de cuid (`c` + 24 caracteres alfanuméricos) para pasar la validación de ids. */
export function newId(): string {
  return `c${randomBytes(12).toString('hex')}`;
}

function paginate<T>(items: T[], request: PageRequest): Page<T> {
  const start = (request.page - 1) * request.limit;
  return { items: items.slice(start, start + request.limit), total: items.length };
}

function inRange(date: Date, range: DateRange): boolean {
  return (!range.createdFrom || date >= range.createdFrom) && (!range.createdTo || date <= range.createdTo);
}

function newestFirst<T extends { createdAt: Date }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export class FakePasswordHasher implements IPasswordHasher {
  async hash(password: string): Promise<string> {
    return `hash:${password}`;
  }

  async compare(password: string, hash: string): Promise<boolean> {
    return hash === `hash:${password}`;
  }
}

export class FakeTokenService implements ITokenService {
  private readonly issued = new Map<string, AuthenticatedUser>();
  readonly expiresInSeconds = 3600;

  sign(user: AuthenticatedUser): string {
    const token = `token-${newId()}`;
    this.issued.set(token, { id: user.id, role: user.role });
    return token;
  }

  verify(token: string): AuthenticatedUser | null {
    return this.issued.get(token) ?? null;
  }

  /** Simula un token vencido o revocado. */
  revoke(token: string): void {
    this.issued.delete(token);
  }
}

export class FakeFileStorage implements IFileStorage {
  readonly files = new Map<string, FileToUpload>();
  configured = true;
  failing = false;

  async upload(file: FileToUpload, folder: string): Promise<string> {
    if (!this.configured) throw new FileStorageError('NOT_CONFIGURED', 'sin configurar');
    if (this.failing) throw new FileStorageError('UPLOAD_FAILED', 'falló');
    const url = `https://storage.test/${folder}/${newId()}`;
    this.files.set(url, file);
    return url;
  }

  async remove(url: string): Promise<void> {
    this.files.delete(url);
  }
}

export class InMemoryUserRepository implements IUserRepository {
  readonly users: User[] = [];

  async create(user: NewUser): Promise<User> {
    const created: User = { id: newId(), createdAt: new Date(), ...user };
    this.users.push(created);
    return created;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.users.find((user) => user.email === email) ?? null;
  }

  async findById(id: string): Promise<User | null> {
    return this.users.find((user) => user.id === id) ?? null;
  }

  delete(id: string): void {
    const index = this.users.findIndex((user) => user.id === id);
    if (index >= 0) this.users.splice(index, 1);
  }
}

export class InMemoryCatalogRepository implements ICatalogRepository {
  readonly items: CatalogItem[] = [];

  async list(filter: CatalogFilter): Promise<Page<CatalogItem>> {
    const search = filter.search?.toLowerCase();
    const matches = this.items.filter(
      (item) =>
        (!filter.state || item.state === filter.state) &&
        (!filter.category || item.category === filter.category) &&
        (!filter.direction || item.direction === filter.direction) &&
        (!search || [item.title, item.code, item.description].some((field) => field.toLowerCase().includes(search))) &&
        inRange(item.createdAt, filter),
    );
    return paginate(newestFirst(matches), filter);
  }

  async findById(id: string): Promise<CatalogItem | null> {
    return copy(this.items.find((item) => item.id === id));
  }

  async findByKey(key: CatalogItemKey): Promise<CatalogItem | null> {
    // Prisma rechaza claves únicas con campos extra; el doble replica esa restricción.
    if (Object.keys(key).length !== 3) throw new Error('La clave debe tener solo category, direction y code.');
    return (
      this.items.find(
        (item) => item.category === key.category && item.direction === key.direction && item.code === key.code,
      ) ?? null
    );
  }

  async findActiveByCategoryAndCode(category: string, code: string): Promise<CatalogItem | null> {
    return (
      this.items.find((item) => item.category === category && item.code === code && item.state === 'ACTIVE') ?? null
    );
  }

  async create(item: NewCatalogItem): Promise<CatalogItem> {
    const now = new Date();
    const created: CatalogItem = {
      id: newId(),
      state: 'ACTIVE',
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
      ...item,
    };
    this.items.push(created);
    return { ...created };
  }

  async update(id: string, changes: CatalogItemChanges): Promise<CatalogItem> {
    const item = this.require(id);
    Object.assign(item, withoutUndefined(changes), { updatedAt: new Date() });
    if (changes.state === 'ACTIVE') item.deletedAt = null;
    return { ...item };
  }

  async remove(id: string): Promise<void> {
    Object.assign(this.require(id), { state: 'REMOVED', deletedAt: new Date() });
  }

  private require(id: string): CatalogItem {
    const item = this.items.find((candidate) => candidate.id === id);
    if (!item) throw new Error(`Ítem ${id} inexistente`);
    return item;
  }
}

export class InMemoryInteractionRepository implements IInteractionRepository {
  private readonly rows: Interaction[] = [];

  constructor(
    private readonly users: InMemoryUserRepository,
    private readonly catalog: InMemoryCatalogRepository,
  ) {}

  async list(filter: InteractionFilter): Promise<Page<Interaction>> {
    const matches = this.rows.filter(
      (row) =>
        row.state === 'ACTIVE' &&
        (!filter.userId || row.userId === filter.userId) &&
        (!filter.type || row.type === filter.type) &&
        inRange(row.createdAt, filter),
    );
    return paginate(newestFirst(matches), filter);
  }

  async findById(id: string): Promise<Interaction | null> {
    return this.rows.find((row) => row.id === id && row.state === 'ACTIVE') ?? null;
  }

  async create(interaction: NewInteraction): Promise<Interaction> {
    const now = new Date();
    const row: Interaction = {
      id: newId(),
      ...interaction,
      state: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
      user: this.userSummary(interaction.userId),
      catalogItem: this.itemSummary(interaction.catalogItemId),
    };
    this.rows.push(row);
    return row;
  }

  async update(id: string, changes: InteractionChanges): Promise<Interaction> {
    const row = this.rows.find((candidate) => candidate.id === id);
    if (!row) throw new Error(`Interacción ${id} inexistente`);
    Object.assign(row, changes, { updatedAt: new Date(), catalogItem: this.itemSummary(changes.catalogItemId) });
    return row;
  }

  async remove(id: string): Promise<void> {
    const row = this.rows.find((candidate) => candidate.id === id);
    if (row) row.state = 'REMOVED';
  }

  private userSummary(id: string): Interaction['user'] {
    const user = this.users.users.find((candidate) => candidate.id === id);
    if (!user) throw new Error(`Usuario ${id} inexistente`);
    return { id: user.id, name: user.name, email: user.email };
  }

  private itemSummary(id: string): Interaction['catalogItem'] {
    const item = this.catalog.items.find((candidate) => candidate.id === id);
    if (!item) throw new Error(`Ítem ${id} inexistente`);
    return { id: item.id, category: item.category, code: item.code, title: item.title };
  }
}

export class InMemoryContactRepository implements IContactRepository {
  private readonly rows: ContactRequest[] = [];

  async list(filter: ContactFilter): Promise<Page<ContactRequest>> {
    const search = filter.search?.toLowerCase();
    const matches = this.rows.filter(
      (row) =>
        row.state === 'ACTIVE' &&
        (!filter.userId || row.userId === filter.userId) &&
        (!filter.tipoProducto || row.tipoProducto === filter.tipoProducto) &&
        (!search ||
          [row.nombreCompleto, row.email, row.empresa ?? '', row.descripcionCaso].some((field) =>
            field.toLowerCase().includes(search),
          )) &&
        inRange(row.createdAt, filter),
    );
    return paginate(newestFirst(matches), filter);
  }

  async findById(id: string): Promise<ContactRequest | null> {
    return this.rows.find((row) => row.id === id && row.state === 'ACTIVE') ?? null;
  }

  async create(request: NewContactRequest): Promise<ContactRequest> {
    const now = new Date();
    const row: ContactRequest = { id: newId(), ...request, state: 'ACTIVE', createdAt: now, updatedAt: now };
    this.rows.push(row);
    return row;
  }

  async update(id: string, changes: ContactRequestChanges): Promise<ContactRequest> {
    const row = this.rows.find((candidate) => candidate.id === id);
    if (!row) throw new Error(`Solicitud ${id} inexistente`);
    Object.assign(row, withoutUndefined(changes), { updatedAt: new Date() });
    return row;
  }

  async remove(id: string): Promise<void> {
    const row = this.rows.find((candidate) => candidate.id === id);
    if (row) row.state = 'REMOVED';
  }
}

/** Los repositorios reales devuelven filas nuevas; el doble copia para no compartir referencias mutables. */
function copy<T extends object>(value: T | undefined): T | null {
  return value ? { ...value } : null;
}

function withoutUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<T>;
}

/** Conjunto completo de dobles en memoria para casos de uso y pruebas HTTP. */
export function createInMemoryInfrastructure() {
  const users = new InMemoryUserRepository();
  const catalog = new InMemoryCatalogRepository();
  return {
    users,
    catalog,
    interactions: new InMemoryInteractionRepository(users, catalog),
    contacts: new InMemoryContactRepository(),
    passwords: new FakePasswordHasher(),
    tokens: new FakeTokenService(),
    files: new FakeFileStorage(),
    checkDatabase: async (): Promise<void> => {},
  };
}
