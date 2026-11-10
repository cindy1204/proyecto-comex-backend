import jwt from 'jsonwebtoken';
import request from 'supertest';
import express from 'express';
import { describe, expect, it, vi } from 'vitest';
import { AuthUseCase } from '../../src/application/use-cases/auth.use-case.js';
import { JwtTokenService } from '../../src/infrastructure/services/jwt.service.js';
import { createAuthenticate } from '../../src/interface/middlewares/auth.middleware.js';
import { errorHandler } from '../../src/interface/middlewares/error.handler.js';
import { createInMemoryInfrastructure } from '../support/in-memory.js';

const SECRET = 'secreto-de-pruebas-con-mas-de-32-caracteres';
const OTHER_SECRET = 'otro-secreto-de-pruebas-con-mas-de-32-caracteres';

function base64url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

/** Token sin firma (`alg: none`), el ataque clásico contra verificadores laxos. */
function unsignedToken(payload: object): string {
  return `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url(payload)}.`;
}

describe('JwtTokenService', () => {
  const service = new JwtTokenService(SECRET, 3600);

  it('firma y verifica un token válido con id y rol', () => {
    const token = service.sign({ id: 'u1', role: 'admin' });

    expect(service.verify(token)).toEqual({ id: 'u1', role: 'admin' });
    expect(jwt.decode(token, { complete: true })?.header.alg).toBe('HS256');
  });

  it('rechaza un token expirado', () => {
    vi.useFakeTimers();
    try {
      const token = service.sign({ id: 'u1', role: 'user' });
      vi.advanceTimersByTime(3601 * 1000);

      expect(service.verify(token)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('rechaza un token firmado con otro secreto', () => {
    const forged = jwt.sign({ role: 'admin' }, OTHER_SECRET, { subject: 'u1', algorithm: 'HS256' });

    expect(service.verify(forged)).toBeNull();
  });

  it('rechaza un token con alg none, con o sin subject y rol', () => {
    expect(service.verify(unsignedToken({ sub: 'u1', role: 'admin' }))).toBeNull();
    expect(service.verify(unsignedToken({}))).toBeNull();
  });

  it('rechaza un token firmado con otro algoritmo aunque el secreto sea el correcto', () => {
    const hs512 = jwt.sign({ role: 'admin' }, SECRET, { subject: 'u1', algorithm: 'HS512' });

    expect(service.verify(hs512)).toBeNull();
  });

  it('rechaza un token sin claim sub', () => {
    const noSubject = jwt.sign({ role: 'user' }, SECRET, { algorithm: 'HS256' });

    expect(service.verify(noSubject)).toBeNull();
  });

  it('rechaza un token con rol ausente o desconocido', () => {
    const noRole = jwt.sign({}, SECRET, { subject: 'u1', algorithm: 'HS256' });
    const unknownRole = jwt.sign({ role: 'superadmin' }, SECRET, { subject: 'u1', algorithm: 'HS256' });

    expect(service.verify(noRole)).toBeNull();
    expect(service.verify(unknownRole)).toBeNull();
  });

  it.each(['', 'abc', 'a.b.c', 'Bearer x'])('rechaza el texto basura %j', (garbage) => {
    expect(service.verify(garbage)).toBeNull();
  });
});

describe('guard de autenticación con JwtTokenService real', () => {
  function build() {
    const infra = createInMemoryInfrastructure();
    const tokens = new JwtTokenService(SECRET, 3600);
    const auth = new AuthUseCase(infra.users, infra.passwords, tokens);
    const app = express();
    app.get('/protegida', createAuthenticate(auth), (req, res) => {
      res.json({ auth: req.auth });
    });
    app.use(errorHandler);
    return { app, infra, auth, tokens };
  }

  it('acepta un token vigente de un usuario existente', async () => {
    const { app, auth } = build();
    const session = await auth.register({ name: 'Ana', email: 'ana@test.com', password: 'Secreta#123' });

    const response = await request(app).get('/protegida').set('Authorization', `Bearer ${session.token}`);

    expect(response.status).toBe(200);
    expect(response.body.auth).toEqual({ id: session.user.id, role: 'user' });
  });

  it.each([
    ['firmado con otro secreto', () => jwt.sign({ role: 'admin' }, OTHER_SECRET, { subject: 'u1' })],
    ['alg none', () => unsignedToken({ sub: 'u1', role: 'admin' })],
    ['sin sub', () => jwt.sign({ role: 'admin' }, SECRET)],
  ])('responde 401 con un token %s', async (_case, makeToken) => {
    const { app } = build();

    const response = await request(app).get('/protegida').set('Authorization', `Bearer ${makeToken()}`);

    expect(response.status).toBe(401);
  });

  it('responde 401 con un token expirado', async () => {
    const { app } = build();
    const expired = jwt.sign({ role: 'user' }, SECRET, { subject: 'u1', expiresIn: -10 });

    const response = await request(app).get('/protegida').set('Authorization', `Bearer ${expired}`);

    expect(response.status).toBe(401);
  });

  it('responde 401 si el sub es de un usuario que no existe', async () => {
    const { app, tokens } = build();
    const foreign = tokens.sign({ id: 'cusuarioquenoexiste00000', role: 'admin' });

    const response = await request(app).get('/protegida').set('Authorization', `Bearer ${foreign}`);

    expect(response.status).toBe(401);
  });

  it('el rol sale de la base de datos, no del claim del token', async () => {
    const { app, auth, infra } = build();
    const session = await auth.register({ name: 'Ana', email: 'ana@test.com', password: 'Secreta#123' });
    const escalated = jwt.sign({ role: 'admin' }, SECRET, { subject: session.user.id, algorithm: 'HS256' });

    const response = await request(app).get('/protegida').set('Authorization', `Bearer ${escalated}`);

    expect(infra.users.users[0]?.role).toBe('user');
    expect(response.status).toBe(200);
    expect(response.body.auth.role).toBe('user');
  });
});
