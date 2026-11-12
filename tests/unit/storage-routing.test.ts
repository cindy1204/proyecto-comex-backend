import { describe, expect, it } from 'vitest';
import type {
  IStoredFileRepository,
  NewStoredFile,
  StoredFile,
} from '../../src/domain/repository/IStoredFile.repository.js';
import { FileStorageError, type FileToUpload } from '../../src/domain/services/IFileStorage.js';
import {
  DatabaseFileStorage,
  STORED_FILE_URL_PREFIX,
} from '../../src/infrastructure/services/database-storage.service.js';
import { RoutedFileStorage, type RemoteFileStorage } from '../../src/infrastructure/services/routed-storage.service.js';
import { InMemoryStoredFileRepository } from '../support/in-memory.js';

const PNG: FileToUpload = {
  content: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
  mimeType: 'image/png',
  size: 4,
  originalName: 'foto.png',
};

/** Almacenamiento remoto simulado (Supabase) con control de configuración. */
class FakeRemote implements RemoteFileStorage {
  readonly uploads: string[] = [];
  readonly removals: string[] = [];
  constructor(private readonly configured: boolean) {}

  isConfigured(): boolean {
    return this.configured;
  }

  async upload(_file: FileToUpload, folder: string): Promise<string> {
    this.uploads.push(folder);
    return `https://bucket.test/${folder}/remote.png`;
  }

  async remove(url: string): Promise<void> {
    this.removals.push(url);
  }
}

class FailingRepository implements IStoredFileRepository {
  async create(_file: NewStoredFile): Promise<string> {
    throw new Error('conexión perdida');
  }
  async findById(_id: string): Promise<StoredFile | null> {
    return null;
  }
  async delete(_id: string): Promise<void> {}
}

describe('DatabaseFileStorage', () => {
  it('guarda el archivo en la base de datos y devuelve una URL relativa a la API', async () => {
    const repository = new InMemoryStoredFileRepository();
    const url = await new DatabaseFileStorage(repository).upload(PNG);

    expect(url).toMatch(new RegExp(`^${STORED_FILE_URL_PREFIX}[a-z0-9]+$`));
    const id = url.slice(STORED_FILE_URL_PREFIX.length);
    expect(repository.files.get(id)).toMatchObject({ mimeType: 'image/png' });
  });

  it('borra el registro a partir de su URL y no toca URLs ajenas', async () => {
    const repository = new InMemoryStoredFileRepository();
    const storage = new DatabaseFileStorage(repository);
    const url = await storage.upload(PNG);

    await storage.remove('https://bucket.test/catalogo/otro.png');
    expect(repository.files.size).toBe(1);

    await storage.remove(url);
    expect(repository.files.size).toBe(0);
  });

  it('convierte un fallo de la base de datos en UPLOAD_FAILED', async () => {
    const storage = new DatabaseFileStorage(new FailingRepository());
    await expect(storage.upload(PNG)).rejects.toMatchObject({
      name: 'FileStorageError',
      reason: 'UPLOAD_FAILED',
    });
    await expect(storage.upload(PNG)).rejects.toBeInstanceOf(FileStorageError);
  });
});

describe('RoutedFileStorage', () => {
  it('usa la base de datos cuando Supabase no está configurado', async () => {
    const remote = new FakeRemote(false);
    const repository = new InMemoryStoredFileRepository();
    const storage = new RoutedFileStorage(remote, new DatabaseFileStorage(repository));

    const url = await storage.upload(PNG, 'catalogo');

    expect(url.startsWith(STORED_FILE_URL_PREFIX)).toBe(true);
    expect(remote.uploads).toEqual([]);
    expect(repository.files.size).toBe(1);
  });

  it('usa Supabase cuando está configurado', async () => {
    const remote = new FakeRemote(true);
    const repository = new InMemoryStoredFileRepository();
    const storage = new RoutedFileStorage(remote, new DatabaseFileStorage(repository));

    expect(await storage.upload(PNG, 'catalogo')).toBe('https://bucket.test/catalogo/remote.png');
    expect(repository.files.size).toBe(0);
  });

  it('borra cada archivo en el destino que indica su URL, aunque cambie la configuración', async () => {
    const remote = new FakeRemote(false);
    const repository = new InMemoryStoredFileRepository();
    const storage = new RoutedFileStorage(remote, new DatabaseFileStorage(repository));
    const local = await storage.upload(PNG, 'catalogo');

    await storage.remove(local);
    await storage.remove('https://bucket.test/catalogo/remote.png');

    expect(repository.files.size).toBe(0);
    expect(remote.removals).toEqual(['https://bucket.test/catalogo/remote.png']);
  });
});
