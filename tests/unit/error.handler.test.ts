import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ZodError } from 'zod';
import { z } from 'zod';
import { ConflictError } from '../../src/application/errors/conflict.error.js';
import { logger } from '../../src/infrastructure/logger.js';
import { errorHandler, notFound } from '../../src/interface/middlewares/error.handler.js';

/** App mínima: una ruta que lanza el error indicado y el manejador real. */
function appThrowing(error: unknown) {
  const app = express();
  app.use(express.json({ limit: '1kb' }));
  app.get('/boom', () => {
    throw error;
  });
  app.get('/items/:id', (_req, res) => {
    res.json({});
  });
  app.post('/echo', (_req, res) => {
    res.json({});
  });
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

function prismaError(code: string): Error {
  return Object.assign(new Error(`Invalid \`prisma.x()\` invocation at /srv/secret/path.ts`), { code });
}

describe('errorHandler', () => {
  beforeEach(() => {
    vi.spyOn(logger, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mapea errores de aplicación con su estado y código', async () => {
    const response = await request(appThrowing(new ConflictError('Ya existe.'))).get('/boom');

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: { code: 'CONFLICT', message: 'Ya existe.' } });
  });

  it('mapea ZodError a 400 con details por campo', async () => {
    const parsed = z.object({ email: z.email() }).safeParse({ email: 'x' });
    const error = parsed.error as ZodError;

    const response = await request(appThrowing(error)).get('/boom');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toEqual([{ field: 'email', message: expect.any(String) }]);
  });

  it.each([
    ['P2002', 409, 'CONFLICT'],
    ['P2003', 409, 'CONFLICT'],
    ['P2025', 404, 'NOT_FOUND'],
    ['P2000', 400, 'VALIDATION_ERROR'],
    ['P2006', 400, 'VALIDATION_ERROR'],
    ['P2011', 400, 'VALIDATION_ERROR'],
    ['P2012', 400, 'VALIDATION_ERROR'],
    ['P2023', 400, 'VALIDATION_ERROR'],
    ['P2014', 409, 'RELATION_CONFLICT'],
  ])('mapea el error de Prisma %s a %i', async (code, status, errorCode) => {
    const response = await request(appThrowing(prismaError(code))).get('/boom');

    expect(response.status).toBe(status);
    expect(response.body.error.code).toBe(errorCode);
    expect(JSON.stringify(response.body)).not.toContain('prisma');
  });

  it('mapea PrismaClientValidationError a 400 sin filtrar la consulta', async () => {
    const error = Object.assign(new Error('Argument `where` is missing at /srv/secret/path.ts'), {
      name: 'PrismaClientValidationError',
    });

    const response = await request(appThrowing(error)).get('/boom');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(JSON.stringify(response.body)).not.toContain('secret');
  });

  it('responde 500 genérico ante errores de Prisma desconocidos', async () => {
    const response = await request(appThrowing(prismaError('P9999'))).get('/boom');

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe('INTERNAL_ERROR');
  });

  it('responde 413 cuando el cuerpo supera el límite', async () => {
    const response = await request(appThrowing(new Error('x')))
      .post('/echo')
      .send({ texto: 'a'.repeat(5_000) });

    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('responde 400 con JSON malformado', async () => {
    const response = await request(appThrowing(new Error('x')))
      .post('/echo')
      .set('Content-Type', 'application/json')
      .send('{"a":');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_JSON');
  });

  it('responde 400 ante un parámetro de ruta con codificación inválida (URIError)', async () => {
    const response = await request(appThrowing(new Error('x'))).get('/items/%');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('BAD_REQUEST');
  });

  it('mapea un URIError lanzado a 400', async () => {
    const response = await request(appThrowing(new URIError('URI malformed'))).get('/boom');

    expect(response.status).toBe(400);
  });

  it('responde 404 en rutas inexistentes con el formato de error', async () => {
    const response = await request(appThrowing(new Error('x'))).get('/nada');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('responde 500 genérico sin stack ni detalles internos y registra el error', async () => {
    const response = await request(appThrowing(new Error('conexión a postgres://secreto@db falló'))).get('/boom');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error interno.' } });
    expect(JSON.stringify(response.body)).not.toMatch(/stack|postgres|secreto/);
    expect(logger.error).toHaveBeenCalled();
  });
});
