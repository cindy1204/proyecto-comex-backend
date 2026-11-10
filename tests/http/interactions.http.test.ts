import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { importData } from '../support/interaction-data.js';
import { createTestApp, type TestApp } from '../support/http-app.js';

describe('API /api/interacciones', () => {
  let t: TestApp;
  let admin: string;
  let owner: { token: string; id: string };
  let stranger: string;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const form = { type: 'formulario-importaciones', data: importData() };

  beforeEach(async () => {
    t = createTestApp();
    admin = (await t.createAdmin()).token;
    owner = await t.registerUser('dueno@test.com');
    stranger = (await t.registerUser('ajeno@test.com')).token;
    await t.infra.catalog.create({
      category: 'importaciones',
      direction: 'EGRESOS',
      code: '2010',
      title: 'Importación',
      description: 'd',
      note: null,
      imageUrl: null,
    });
  });

  it('exige autenticación en todas las rutas', async () => {
    for (const [method, path] of [
      ['post', '/api/interacciones'],
      ['get', '/api/interacciones'],
      ['get', '/api/interacciones/mias'],
      ['get', '/api/interacciones/cabc'],
    ] as const) {
      expect((await request(t.app)[method](path)).status).toBe(401);
    }
  });

  it('crea una interacción (201) con numeral resuelto y sin exponer user al dueño', async () => {
    const response = await request(t.app).post('/api/interacciones').set(auth(owner.token)).send(form);

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      userId: owner.id,
      type: 'formulario-importaciones',
      state: 'ACTIVE',
      catalogItem: { category: 'importaciones', code: '2010' },
    });
    expect(response.body.data).not.toHaveProperty('user');
  });

  it('valida el cuerpo: numeral inexistente 400, tipo desconocido 400, campos extra 400', async () => {
    const send = (payload: object) => request(t.app).post('/api/interacciones').set(auth(owner.token)).send(payload);

    expect((await send({ ...form, data: importData({ numeralOperacion: '0000' }) })).status).toBe(400);
    expect((await send({ ...form, type: 'otro' })).status).toBe(400);
    expect((await send({ ...form, extra: 1 })).status).toBe(400);
    expect((await send({ type: form.type, data: importData({ observaciones: 'a\u0000b' }) })).status).toBe(400);
  });

  it('GET / es solo para administradores y GET /mias lista las propias', async () => {
    await request(t.app).post('/api/interacciones').set(auth(owner.token)).send(form);
    await request(t.app).post('/api/interacciones').set(auth(stranger)).send(form);

    const forbidden = await request(t.app).get('/api/interacciones').set(auth(owner.token));
    const all = await request(t.app).get('/api/interacciones').set(auth(admin));
    const mine = await request(t.app).get('/api/interacciones/mias').set(auth(owner.token));
    const byUser = await request(t.app).get(`/api/interacciones?userId=${owner.id}`).set(auth(admin));

    expect(forbidden.status).toBe(403);
    expect(all.body.pagination.total).toBe(2);
    expect(all.body.data[0]).toHaveProperty('user');
    expect(mine.body.pagination).toEqual({ total: 1, currentPage: 1, limit: 10, totalPages: 1 });
    expect(byUser.body.pagination.total).toBe(1);
  });

  it('un ajeno recibe 404; el dueño y el admin leen, editan y borran lógicamente', async () => {
    const created = (await request(t.app).post('/api/interacciones').set(auth(owner.token)).send(form)).body.data;
    const url = `/api/interacciones/${created.id}`;

    expect((await request(t.app).get(url).set(auth(stranger))).status).toBe(404);
    expect(
      (
        await request(t.app)
          .put(url)
          .set(auth(stranger))
          .send({ data: { valorFob: '1' } })
      ).status,
    ).toBe(404);
    expect((await request(t.app).delete(url).set(auth(stranger))).status).toBe(404);
    expect((await request(t.app).get(url).set(auth(admin))).status).toBe(200);

    const updated = await request(t.app)
      .put(url)
      .set(auth(owner.token))
      .send({ data: { valorFob: '5' } });
    expect(updated.status).toBe(200);
    expect(updated.body.data.data).toEqual(importData({ valorFob: '5', observaciones: '' }));

    const patched = await request(t.app)
      .patch(url)
      .set(auth(owner.token))
      .send({ data: { valorFob: '7' } });
    expect(patched.status).toBe(200);
    expect(patched.body.data.data).toEqual(importData({ valorFob: '7', observaciones: '' }));
    expect(
      (
        await request(t.app)
          .patch(url)
          .set(auth(stranger))
          .send({ data: { valorFob: '1' } })
      ).status,
    ).toBe(404);
    expect(
      (
        await request(t.app)
          .patch(url)
          .send({ data: { valorFob: '1' } })
      ).status,
    ).toBe(401);

    expect((await request(t.app).delete(url).set(auth(owner.token))).status).toBe(204);
    expect((await request(t.app).get(url).set(auth(owner.token))).status).toBe(404);
  });

  it('responde 400 ante un id inválido y ante ?type desconocido', async () => {
    expect((await request(t.app).get('/api/interacciones/abc').set(auth(admin))).status).toBe(400);
    expect((await request(t.app).get('/api/interacciones/mias?type=x').set(auth(owner.token))).status).toBe(400);
  });
});
