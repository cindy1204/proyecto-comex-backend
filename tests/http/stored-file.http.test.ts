import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/interface/app.js';
import { buildContainer } from '../../src/interface/container.js';
import {
  DatabaseFileStorage,
  STORED_FILE_URL_PREFIX,
} from '../../src/infrastructure/services/database-storage.service.js';
import { RoutedFileStorage, type RemoteFileStorage } from '../../src/infrastructure/services/routed-storage.service.js';
import type { FileToUpload } from '../../src/domain/services/IFileStorage.js';
import { createInMemoryInfrastructure } from '../support/in-memory.js';
import type { Infrastructure } from '../../src/interface/container.js';
import { ORIGIN, PNG_BYTES } from '../support/http-app.js';

/** Sin Supabase configurado: las imágenes se guardan en la base de datos. */
const UNCONFIGURED_REMOTE: RemoteFileStorage = {
  isConfigured: () => false,
  upload: async (_file: FileToUpload) => {
    throw new Error('no debería llamarse');
  },
  remove: async () => {},
};

const item = {
  category: 'importaciones',
  direction: 'EGRESOS',
  code: '2010',
  title: 'Pago de importaciones',
  description: 'Descripción del numeral',
};

describe('imágenes guardadas en la base de datos (fallback sin Supabase)', () => {
  let infra: Infrastructure;
  let app: ReturnType<typeof createApp>;
  let admin: string;

  beforeEach(async () => {
    const memory = createInMemoryInfrastructure();
    infra = {
      ...memory,
      files: new RoutedFileStorage(UNCONFIGURED_REMOTE, new DatabaseFileStorage(memory.storedFiles)),
    };
    app = createApp(buildContainer(infra), {
      corsOrigins: [ORIGIN],
      rateLimits: { api: 10_000, auth: 10_000, contact: 10_000, upload: 10_000 },
    });
    const user = await infra.users.create({
      name: 'Admin Prueba',
      email: 'admin@test.com',
      passwordHash: await infra.passwords.hash('Admin#2026'),
      role: 'admin',
    });
    admin = infra.tokens.sign({ id: user.id, role: 'admin' });
  });

  const upload = (path: string, method: 'post' | 'patch') =>
    request(app)
      [method](path)
      .set('Authorization', `Bearer ${admin}`)
      .field('category', item.category)
      .field('direction', item.direction)
      .field('code', item.code)
      .field('title', item.title)
      .field('description', item.description)
      .attach('image', PNG_BYTES, { filename: 'foto.png', contentType: 'image/png' });

  it('crea el numeral con una URL relativa y sirve la imagen desde la API', async () => {
    const created = await upload('/api/catalogos', 'post');

    expect(created.status).toBe(201);
    const url = created.body.data.imageUrl as string;
    expect(url.startsWith(STORED_FILE_URL_PREFIX)).toBe(true);

    const image = await request(app).get(url);
    expect(image.status).toBe(200);
    expect(image.headers['content-type']).toBe('image/png');
    expect(image.headers['cross-origin-resource-policy']).toBe('cross-origin');
    expect(image.headers['cache-control']).toContain('max-age');
    expect(Buffer.compare(image.body as Buffer, PNG_BYTES)).toBe(0);
  });

  it('borra la imagen anterior al reemplazarla', async () => {
    const created = await upload('/api/catalogos', 'post');
    const oldUrl = created.body.data.imageUrl as string;

    const updated = await upload(`/api/catalogos/${created.body.data.id}`, 'patch');
    expect(updated.status).toBe(200);
    expect(updated.body.data.imageUrl).not.toBe(oldUrl);

    expect((await request(app).get(oldUrl)).status).toBe(404);
    expect((await request(app).get(updated.body.data.imageUrl as string)).status).toBe(200);
  });

  it('responde 404 para una imagen que no existe', async () => {
    const response = await request(app).get(`${STORED_FILE_URL_PREFIX}cmissingimage0000000000`);
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('rechaza identificadores que no son CUID', async () => {
    const response = await request(app).get(`${STORED_FILE_URL_PREFIX}no-es-un-id`);
    expect(response.status).toBe(400);
  });
});
