import type { Express } from 'express';
import request from 'supertest';
import { createApp } from '../../src/interface/app.js';
import { buildContainer } from '../../src/interface/container.js';
import { createInMemoryInfrastructure } from './in-memory.js';

export const ORIGIN = 'http://localhost:3000';

export const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

export interface TestApp {
  app: Express;
  infra: ReturnType<typeof createInMemoryInfrastructure>;
  /** Registra un usuario por la API pública y devuelve su token. */
  registerUser(email?: string): Promise<{ token: string; id: string }>;
  /** Siembra un administrador directamente en el repositorio (no existe vía pública) y devuelve su token. */
  createAdmin(email?: string): Promise<{ token: string; id: string }>;
}

export function createTestApp(): TestApp {
  const infra = createInMemoryInfrastructure();
  const app = createApp(buildContainer(infra), {
    corsOrigins: [ORIGIN],
    rateLimits: { api: 10_000, auth: 10_000, contact: 10_000, upload: 10_000 },
  });

  return {
    app,
    infra,
    async registerUser(email = 'usuario@test.com') {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Usuario Prueba', email, password: 'Usuario#2026' });
      return { token: response.body.data.token as string, id: response.body.data.user.id as string };
    },
    async createAdmin(email = 'admin@test.com') {
      const admin = await infra.users.create({
        name: 'Admin Prueba',
        email,
        passwordHash: await infra.passwords.hash('Admin#2026'),
        role: 'admin',
      });
      return { token: infra.tokens.sign({ id: admin.id, role: 'admin' }), id: admin.id };
    },
  };
}
