import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, PNG_BYTES, type TestApp } from '../support/http-app.js';

const item = {
  category: 'importaciones',
  direction: 'EGRESOS',
  code: '2010',
  title: 'Pago de importaciones',
  description: 'Descripción del numeral',
};

describe('API /api/catalogos', () => {
  let t: TestApp;
  let admin: string;
  let user: string;

  beforeEach(async () => {
    t = createTestApp();
    admin = (await t.createAdmin()).token;
    user = (await t.registerUser()).token;
  });

  const create = (payload: object = item) =>
    request(t.app).post('/api/catalogos').set('Authorization', `Bearer ${admin}`).send(payload);

  it('crea un numeral con el modelo completo del contrato', async () => {
    const response = await create();

    expect(response.status).toBe(201);
    expect(Object.keys(response.body.data).sort()).toEqual(
      [
        'category',
        'code',
        'createdAt',
        'description',
        'direction',
        'id',
        'imageUrl',
        'note',
        'state',
        'title',
        'updatedAt',
      ].sort(),
    );
    expect(response.body.data).toMatchObject({ note: null, imageUrl: null, state: 'ACTIVE' });
  });

  it('exige autenticación (401) y rol admin (403) para escribir', async () => {
    const anonymous = await request(t.app).post('/api/catalogos').send(item);
    const forbidden = await request(t.app).post('/api/catalogos').set('Authorization', `Bearer ${user}`).send(item);

    expect(anonymous.status).toBe(401);
    expect(forbidden.status).toBe(403);
  });

  it('rechaza un duplicado con 409 y datos inválidos con 400', async () => {
    await create();

    const duplicate = await create();
    const invalid = await create({ ...item, code: '', direction: 'OTRO' });

    expect(duplicate.status).toBe(409);
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.details.length).toBeGreaterThan(0);
  });

  it('no acepta imageUrl en el cuerpo', async () => {
    const response = await create({ ...item, imageUrl: 'https://evil.test/x.png' });

    expect(response.status).toBe(400);
  });

  it('crea con imagen en multipart y la devuelve en imageUrl', async () => {
    const response = await request(t.app)
      .post('/api/catalogos')
      .set('Authorization', `Bearer ${admin}`)
      .field('category', item.category)
      .field('direction', item.direction)
      .field('code', item.code)
      .field('title', item.title)
      .field('description', item.description)
      .attach('image', PNG_BYTES, { filename: 'foto.png', contentType: 'image/png' });

    expect(response.status).toBe(201);
    expect(response.body.data.imageUrl).toMatch(/^https:\/\/storage\.test\/catalogo\//);
  });

  it('responde 503 con imagen si el almacenamiento no está configurado', async () => {
    t.infra.files.configured = false;

    const response = await request(t.app)
      .post('/api/catalogos')
      .set('Authorization', `Bearer ${admin}`)
      .field('category', item.category)
      .field('direction', item.direction)
      .field('code', item.code)
      .field('title', item.title)
      .field('description', item.description)
      .attach('image', PNG_BYTES, { filename: 'foto.png', contentType: 'image/png' });

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('IMAGE_STORAGE_NOT_CONFIGURED');
  });

  it('rechaza imágenes con tipo o firma inválidos', async () => {
    const attach = (content: Buffer, contentType: string) =>
      request(t.app)
        .post('/api/catalogos')
        .set('Authorization', `Bearer ${admin}`)
        .field('category', item.category)
        .field('direction', item.direction)
        .field('code', item.code)
        .field('title', item.title)
        .field('description', item.description)
        .attach('image', content, { filename: 'x', contentType });

    expect((await attach(PNG_BYTES, 'image/gif')).status).toBe(415);
    expect((await attach(Buffer.from('no es una imagen'), 'image/png')).status).toBe(400);
  });

  it('no existe POST /:id/imagen', async () => {
    const created = await create();

    const response = await request(t.app)
      .post(`/api/catalogos/${created.body.data.id}/imagen`)
      .set('Authorization', `Bearer ${admin}`)
      .attach('image', PNG_BYTES, { filename: 'foto.png', contentType: 'image/png' });

    expect(response.status).toBe(404);
  });

  it('actualiza con PUT (JSON) y exige al menos un campo', async () => {
    const created = await create();
    const id = created.body.data.id;

    const updated = await request(t.app)
      .put(`/api/catalogos/${id}`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ title: 'Nuevo' });
    const empty = await request(t.app).put(`/api/catalogos/${id}`).set('Authorization', `Bearer ${admin}`).send({});

    expect(updated.status).toBe(200);
    expect(updated.body.data.title).toBe('Nuevo');
    expect(empty.status).toBe(400);
  });

  it('PATCH equivale a PUT: actualiza parcialmente y exige al menos un campo', async () => {
    const id = (await create()).body.data.id;
    const patch = (payload: object) =>
      request(t.app).patch(`/api/catalogos/${id}`).set('Authorization', `Bearer ${admin}`).send(payload);

    const updated = await patch({ title: 'Parcial' });
    const empty = await patch({});
    const anonymous = await request(t.app).patch(`/api/catalogos/${id}`).send({ title: 'x' });
    const forbidden = await request(t.app)
      .patch(`/api/catalogos/${id}`)
      .set('Authorization', `Bearer ${user}`)
      .send({ title: 'x' });

    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({ title: 'Parcial', code: item.code, description: item.description });
    expect(empty.status).toBe(400);
    expect(anonymous.status).toBe(401);
    expect(forbidden.status).toBe(403);
  });

  it('PATCH acepta multipart con imagen', async () => {
    const id = (await create()).body.data.id;

    const response = await request(t.app)
      .patch(`/api/catalogos/${id}`)
      .set('Authorization', `Bearer ${admin}`)
      .attach('image', PNG_BYTES, { filename: 'foto.png', contentType: 'image/png' });

    expect(response.status).toBe(200);
    expect(response.body.data.imageUrl).toMatch(/^https:\/\/storage\.test\/catalogo\//);
  });

  it('el 409 por código duplicado indica que el numeral eliminado puede restaurarse', async () => {
    const id = (await create()).body.data.id;
    const active = await create();
    await request(t.app).delete(`/api/catalogos/${id}`).set('Authorization', `Bearer ${admin}`);
    const removed = await create();

    expect(active.status).toBe(409);
    expect(active.body.error.message).not.toMatch(/eliminado/);
    expect(removed.status).toBe(409);
    expect(removed.body.error.message).toMatch(/existe/);
    expect(removed.body.error.message).toMatch(/eliminado/);
    expect(removed.body.error.message).toMatch(/state ACTIVE/);
  });

  it('borra lógicamente (204), luego 404, y un admin puede restaurar con state ACTIVE', async () => {
    const id = (await create()).body.data.id;

    const removed = await request(t.app).delete(`/api/catalogos/${id}`).set('Authorization', `Bearer ${admin}`);
    const again = await request(t.app).delete(`/api/catalogos/${id}`).set('Authorization', `Bearer ${admin}`);
    const publicGet = await request(t.app).get(`/api/catalogos/${id}`);
    const adminGet = await request(t.app).get(`/api/catalogos/${id}`).set('Authorization', `Bearer ${admin}`);
    const restored = await request(t.app)
      .put(`/api/catalogos/${id}`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ state: 'ACTIVE' });

    expect(removed.status).toBe(204);
    expect(removed.text).toBe('');
    expect(again.status).toBe(404);
    expect(publicGet.status).toBe(404);
    expect(adminGet.body.data.state).toBe('REMOVED');
    expect(restored.body.data.state).toBe('ACTIVE');
  });

  it('el listado es público, solo muestra activos y pagina con el formato del contrato', async () => {
    for (const code of ['1', '2', '3']) await create({ ...item, code });
    const removed = await create({ ...item, code: '4' });
    await request(t.app).delete(`/api/catalogos/${removed.body.data.id}`).set('Authorization', `Bearer ${admin}`);

    const response = await request(t.app).get('/api/catalogos?page=2&limit=2');
    const all = await request(t.app).get('/api/catalogos?state=ALL');
    const adminAll = await request(t.app).get('/api/catalogos?state=ALL').set('Authorization', `Bearer ${admin}`);

    expect(response.status).toBe(200);
    expect(response.body.pagination).toEqual({ total: 3, currentPage: 2, limit: 2, totalPages: 2 });
    expect(response.body.data).toHaveLength(1);
    expect(all.body.pagination.total).toBe(3);
    expect(adminAll.body.pagination.total).toBe(4);
  });

  it('filtra por categoría, dirección y búsqueda', async () => {
    await create();
    await create({ ...item, category: 'exportaciones', direction: 'INGRESOS', code: '1010', title: 'Venta de café' });

    const byCategory = await request(t.app).get('/api/catalogos?category=exportaciones');
    const byDirection = await request(t.app).get('/api/catalogos?direction=EGRESOS');
    const bySearch = await request(t.app).get('/api/catalogos?search=caf%C3%A9');

    expect(byCategory.body.data.map((row: { code: string }) => row.code)).toEqual(['1010']);
    expect(byDirection.body.data.map((row: { code: string }) => row.code)).toEqual(['2010']);
    expect(bySearch.body.data.map((row: { code: string }) => row.code)).toEqual(['1010']);
  });

  it.each([
    ['page=0'],
    ['page=-1'],
    ['page=abc'],
    ['limit=0'],
    ['limit=51'],
    ['limit=1.5'],
    ['page=99999999999999999999'],
    ['direction=NORTE'],
    ['createdFrom=ayer'],
    ['createdFrom=2026-12-01&createdTo=2026-01-01'],
  ])('responde 400 con la consulta inválida ?%s', async (query) => {
    const response = await request(t.app).get(`/api/catalogos?${query}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('responde 400 con un id que no es cuid y 404 con uno inexistente', async () => {
    const invalid = await request(t.app).get('/api/catalogos/no-es-un-id');
    const missing = await request(t.app).get('/api/catalogos/c000000000000000000000000');

    expect(invalid.status).toBe(400);
    expect(missing.status).toBe(404);
  });
});
