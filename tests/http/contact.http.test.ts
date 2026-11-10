import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, ORIGIN, type TestApp } from '../support/http-app.js';

const contact = {
  nombreCompleto: 'María Pérez',
  email: 'Maria@Test.com',
  tipoProducto: 'importaciones',
  descripcionCaso: 'Necesito asesoría con una importación.',
  montoEstimado: 1500.5,
};

describe('API /api/solicitudes-contacto', () => {
  let t: TestApp;
  let admin: string;
  let owner: { token: string; id: string };
  let stranger: string;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeEach(async () => {
    t = createTestApp();
    admin = (await t.createAdmin()).token;
    owner = await t.registerUser('dueno@test.com');
    stranger = (await t.registerUser('ajeno@test.com')).token;
  });

  it('crea una solicitud anónima (201) con el modelo del contrato y monto como string', async () => {
    const response = await request(t.app).post('/api/solicitudes-contacto').send(contact);

    expect(response.status).toBe(201);
    expect(Object.keys(response.body.data).sort()).toEqual(
      [
        'createdAt',
        'descripcionCaso',
        'email',
        'empresa',
        'id',
        'montoEstimado',
        'nombreCompleto',
        'state',
        'telefono',
        'tipoProducto',
        'updatedAt',
        'userId',
      ].sort(),
    );
    expect(response.body.data).toMatchObject({
      userId: null,
      email: 'maria@test.com',
      empresa: null,
      montoEstimado: '1500.5',
      state: 'ACTIVE',
    });
  });

  it('asocia al usuario con token válido y responde 401 con un token inválido', async () => {
    const linked = await request(t.app).post('/api/solicitudes-contacto').set(auth(owner.token)).send(contact);
    const invalid = await request(t.app).post('/api/solicitudes-contacto').set(auth('falso')).send(contact);

    expect(linked.body.data.userId).toBe(owner.id);
    expect(invalid.status).toBe(401);
  });

  it.each([
    ['monto negativo', { montoEstimado: -1 }],
    ['monto con 3 decimales', { montoEstimado: '1.234' }],
    ['tipo desconocido', { tipoProducto: 'otro' }],
    ['correo inválido', { email: 'x' }],
    ['carácter nulo', { descripcionCaso: 'a\u0000b' }],
    ['campo no permitido', { montoEstimado: 1, extra: true }],
  ])('rechaza con 400: %s', async (_case, override) => {
    const response = await request(t.app)
      .post('/api/solicitudes-contacto')
      .send({ ...contact, ...override });

    expect(response.status).toBe(400);
  });

  it('no existe /formularios ni alias en singular', async () => {
    expect((await request(t.app).post('/api/solicitudes-contacto/formularios').send(contact)).status).toBe(404);
    expect((await request(t.app).get('/api/solicitud-contacto').set(auth(admin))).status).toBe(404);
    expect((await request(t.app).get('/api/catalogo')).status).toBe(404);
    expect((await request(t.app).get('/api/interaccion').set(auth(admin))).status).toBe(404);
  });

  it('GET / es solo admin, con filtros; GET /mias lista las propias', async () => {
    await request(t.app).post('/api/solicitudes-contacto').set(auth(owner.token)).send(contact);
    await request(t.app)
      .post('/api/solicitudes-contacto')
      .send({ ...contact, tipoProducto: 'exportaciones', nombreCompleto: 'Carlos Ruiz' });

    const forbidden = await request(t.app).get('/api/solicitudes-contacto').set(auth(owner.token));
    const anonymous = await request(t.app).get('/api/solicitudes-contacto');
    const all = await request(t.app).get('/api/solicitudes-contacto').set(auth(admin));
    const byType = await request(t.app).get('/api/solicitudes-contacto?tipoProducto=exportaciones').set(auth(admin));
    const bySearch = await request(t.app).get('/api/solicitudes-contacto?search=carlos').set(auth(admin));
    const mine = await request(t.app).get('/api/solicitudes-contacto/mias').set(auth(owner.token));

    expect(forbidden.status).toBe(403);
    expect(anonymous.status).toBe(401);
    expect(all.body.pagination.total).toBe(2);
    expect(byType.body.pagination.total).toBe(1);
    expect(bySearch.body.data).toHaveLength(1);
    expect(mine.body.pagination.total).toBe(1);
  });

  it('dueño o admin acceden; un ajeno recibe 404; el borrado es lógico (204)', async () => {
    const created = (await request(t.app).post('/api/solicitudes-contacto').set(auth(owner.token)).send(contact)).body
      .data;
    const url = `/api/solicitudes-contacto/${created.id}`;

    expect((await request(t.app).get(url).set(auth(stranger))).status).toBe(404);
    expect((await request(t.app).get(url).set(auth(admin))).status).toBe(200);

    const updated = await request(t.app).put(url).set(auth(owner.token)).send({ empresa: 'ACME', montoEstimado: null });
    expect(updated.body.data).toMatchObject({ empresa: 'ACME', montoEstimado: null });
    expect((await request(t.app).put(url).set(auth(owner.token)).send({})).status).toBe(400);

    const patched = await request(t.app).patch(url).set(auth(owner.token)).send({ empresa: 'Beta' });
    expect(patched.status).toBe(200);
    expect(patched.body.data).toMatchObject({ empresa: 'Beta', montoEstimado: null });
    expect((await request(t.app).patch(url).set(auth(owner.token)).send({})).status).toBe(400);
    expect((await request(t.app).patch(url).set(auth(stranger)).send({ empresa: 'X' })).status).toBe(404);
    expect((await request(t.app).patch(url).send({ empresa: 'X' })).status).toBe(401);

    expect((await request(t.app).delete(url).set(auth(owner.token))).status).toBe(204);
    expect((await request(t.app).get(url).set(auth(admin))).status).toBe(404);
  });
});

describe('comportamiento transversal de la API', () => {
  let t: TestApp;

  beforeEach(() => {
    t = createTestApp();
  });

  it('un cuerpo de más de 1 MB responde 413 con formato de error', async () => {
    const response = await request(t.app)
      .post('/api/solicitudes-contacto')
      .send({ descripcionCaso: 'a'.repeat(2 * 1024 * 1024) });

    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('un "%" en la ruta responde 400 y no 500', async () => {
    const response = await request(t.app).get('/api/catalogos/%');

    expect(response.status).toBe(400);
  });

  it('JSON malformado responde 400', async () => {
    const response = await request(t.app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"a"');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_JSON');
  });

  it('una ruta inexistente responde 404 con el formato de error', async () => {
    const response = await request(t.app).get('/api/nada');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: { code: 'NOT_FOUND', message: expect.any(String) } });
  });

  it('permite el origen configurado y rechaza otros con 403', async () => {
    const allowed = await request(t.app).get('/health').set('Origin', ORIGIN);
    const denied = await request(t.app).get('/health').set('Origin', 'https://evil.test');

    expect(allowed.headers['access-control-allow-origin']).toBe(ORIGIN);
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('CORS_ORIGIN_DENIED');
  });

  it('aplica límite de intentos en login (429 con formato de error)', async () => {
    const limited = createTestApp();
    const { createApp } = await import('../../src/interface/app.js');
    const { buildContainer } = await import('../../src/interface/container.js');
    const app = createApp(buildContainer(limited.infra), {
      corsOrigins: [ORIGIN],
      rateLimits: { api: 1000, auth: 2, contact: 1000, upload: 1000 },
    });

    const statuses: number[] = [];
    for (let attempt = 0; attempt < 3; attempt += 1) {
      statuses.push(
        (await request(app).post('/api/auth/login').send({ email: 'x@test.com', password: 'mala' })).status,
      );
    }

    expect(statuses).toEqual([401, 401, 429]);
  });
});
