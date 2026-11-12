import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from '../support/http-app.js';

describe('API /api/auth', () => {
  let t: TestApp;

  beforeEach(() => {
    t = createTestApp();
  });

  const body = { name: 'Ana Pérez', email: 'ana@test.com', password: 'Secreta#123' };

  /** Ninguna respuesta debe filtrar el hash de la contraseña ni nada con forma de hash bcrypt. */
  const expectNoHashLeak = (responseBody: unknown) =>
    expect(JSON.stringify(responseBody)).not.toMatch(/passwordHash|\$2[aby]\$/);

  it('GET /health responde 200 {status:"ok"}', async () => {
    const response = await request(t.app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('POST /register responde 201 con usuario, token y expiresIn, siempre con rol user', async () => {
    const response = await request(t.app)
      .post('/api/auth/register')
      .send({ ...body, role: 'admin' });

    expect(response.status).toBe(201);
    expect(response.body.data.user).toMatchObject({ name: 'Ana Pérez', email: 'ana@test.com', role: 'user' });
    expect(Object.keys(response.body.data.user).sort()).toEqual(['createdAt', 'email', 'id', 'name', 'role']);
    expect(response.body.data.token).toEqual(expect.any(String));
    expect(response.body.data.expiresIn).toEqual(expect.any(Number));
    expectNoHashLeak(response.body);
  });

  it('POST /register con correo duplicado responde 409', async () => {
    await request(t.app).post('/api/auth/register').send(body);

    const response = await request(t.app).post('/api/auth/register').send(body);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONFLICT');
  });

  it('POST /register valida los datos con details por campo', async () => {
    const response = await request(t.app).post('/api/auth/register').send({ name: 'A', email: 'no', password: '1' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details.map((detail: { field: string }) => detail.field)).toEqual(
      expect.arrayContaining(['name', 'email', 'password']),
    );
  });

  it('POST /login responde 200 con la misma forma y 401 ante credenciales inválidas', async () => {
    await request(t.app).post('/api/auth/register').send(body);

    const ok = await request(t.app).post('/api/auth/login').send({ email: body.email, password: body.password });
    const wrongPassword = await request(t.app)
      .post('/api/auth/login')
      .send({ email: body.email, password: 'incorrecta' });
    const unknownEmail = await request(t.app)
      .post('/api/auth/login')
      .send({ email: 'inexistente@test.com', password: 'incorrecta' });

    expect(ok.status).toBe(200);
    expect(ok.body.data).toEqual(expect.objectContaining({ token: expect.any(String), expiresIn: expect.any(Number) }));
    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
    expect(unknownEmail.status).toBe(401);
    expect(unknownEmail.body.error).toEqual({ code: 'INVALID_CREDENTIALS', message: 'Credenciales inválidas.' });
    expectNoHashLeak(ok.body);
    expectNoHashLeak(wrongPassword.body);
    expectNoHashLeak(unknownEmail.body);
  });

  it('GET /me devuelve el usuario y exige token', async () => {
    const { token, id } = await t.registerUser();

    const ok = await request(t.app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    const missing = await request(t.app).get('/api/auth/me');

    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ id, role: 'user' });
    expect(missing.status).toBe(401);
    expectNoHashLeak(ok.body);
  });

  it('GET /me con el token de un usuario eliminado responde 401', async () => {
    const { token, id } = await t.registerUser();
    t.infra.users.delete(id);

    const response = await request(t.app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(401);
  });

  it('POST /admins exige token (401), rol admin (403) y crea administradores (201)', async () => {
    const user = await t.registerUser();
    const admin = await t.createAdmin();
    const payload = { name: 'Otro Admin', email: 'otro@test.com', password: 'Administrador#2026' };

    const anonymous = await request(t.app).post('/api/auth/admins').send(payload);
    const forbidden = await request(t.app)
      .post('/api/auth/admins')
      .set('Authorization', `Bearer ${user.token}`)
      .send(payload);
    const created = await request(t.app)
      .post('/api/auth/admins')
      .set('Authorization', `Bearer ${admin.token}`)
      .send(payload);

    expect(anonymous.status).toBe(401);
    expect(forbidden.status).toBe(403);
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ email: 'otro@test.com', role: 'admin' });
    expect(created.body.data).not.toHaveProperty('token');
  });
});
