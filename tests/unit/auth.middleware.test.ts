import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthUseCase } from '../../src/application/use-cases/auth.use-case.js';
import {
  authorize,
  createAuthenticate,
  createOptionalAuthenticate,
  requireUser,
} from '../../src/interface/middlewares/auth.middleware.js';
import { createInMemoryInfrastructure } from '../support/in-memory.js';

function request(authorization?: string): Request {
  return { headers: authorization === undefined ? {} : { authorization } } as Request;
}

const response = {} as Response;

describe('middlewares de autenticación', () => {
  let infra: ReturnType<typeof createInMemoryInfrastructure>;
  let auth: AuthUseCase;
  let token: string;
  let userId: string;

  beforeEach(async () => {
    infra = createInMemoryInfrastructure();
    auth = new AuthUseCase(infra.users, infra.passwords, infra.tokens);
    const session = await auth.register({ name: 'Ana', email: 'ana@test.com', password: 'Secreta#123' });
    token = session.token;
    userId = session.user.id;
  });

  describe('authenticate', () => {
    it('adjunta el usuario y continúa con un Bearer válido', async () => {
      const req = request(`Bearer ${token}`);
      const next = vi.fn();

      await createAuthenticate(auth)(req, response, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.auth).toEqual({ id: userId, role: 'user' });
    });

    it.each([
      ['sin token', undefined],
      ['con formato incorrecto', `Token ${'abc'}`],
      ['con un token inválido', 'Bearer no-es-un-token'],
    ])('responde 401 %s', async (_case, header) => {
      const next = vi.fn();

      await createAuthenticate(auth)(request(header), response, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
    });

    it('responde 401 con un token expirado o revocado', async () => {
      infra.tokens.revoke(token);
      const next = vi.fn();

      await createAuthenticate(auth)(request(`Bearer ${token}`), response, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401, code: 'INVALID_TOKEN' }));
    });

    it('responde 401 si el usuario del token ya no existe', async () => {
      infra.users.delete(userId);
      const next = vi.fn();

      await createAuthenticate(auth)(request(`Bearer ${token}`), response, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
    });
  });

  describe('optionalAuthenticate', () => {
    it('deja pasar a un visitante sin encabezado', async () => {
      const req = request();
      const next = vi.fn();

      await createOptionalAuthenticate(auth)(req, response, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.auth).toBeUndefined();
    });

    it('identifica al usuario con un token válido', async () => {
      const req = request(`Bearer ${token}`);
      const next = vi.fn();

      await createOptionalAuthenticate(auth)(req, response, next);

      expect(req.auth?.id).toBe(userId);
    });

    it('responde 401 si el token enviado es inválido', async () => {
      const next = vi.fn();

      await createOptionalAuthenticate(auth)(request('Bearer falso'), response, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
    });
  });

  describe('authorize', () => {
    it('continúa cuando el rol está permitido', () => {
      const req = { auth: { id: 'c1', role: 'admin' } } as Request;
      const next = vi.fn();

      authorize('admin')(req, response, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('responde 403 cuando el rol no está permitido', () => {
      const req = { auth: { id: 'c1', role: 'user' } } as Request;
      const next = vi.fn();

      authorize('admin')(req, response, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
    });

    it('responde 401 si se usa sin autenticar', () => {
      const next = vi.fn();

      authorize('admin')(request(), response, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
    });
  });

  describe('requireUser', () => {
    it('devuelve el usuario autenticado o lanza 401', () => {
      expect(requireUser({ auth: { id: 'c1', role: 'user' } } as Request)).toEqual({ id: 'c1', role: 'user' });
      expect(() => requireUser(request())).toThrow(expect.objectContaining({ status: 401 }));
    });
  });
});
