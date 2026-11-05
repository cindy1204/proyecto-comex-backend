import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { ApplicationError } from '../../../domain/errors.js';

export class HttpError extends ApplicationError {}

export function notFound(_request: Request, _response: Response, next: NextFunction) {
  next(new HttpError(404, 'NOT_FOUND', 'La ruta solicitada no existe.'));
}

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  if (error instanceof ApplicationError) {
    response.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }

  if (error instanceof ZodError) {
    response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Revisa los datos enviados.',
        details: error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
      },
    });
    return;
  }

  if (
    error instanceof SyntaxError
    && typeof error === 'object'
    && error !== null
    && 'type' in error
    && error.type === 'entity.parse.failed'
  ) {
    response.status(400).json({ error: { code: 'INVALID_JSON', message: 'El cuerpo de la petición no contiene JSON válido.' } });
    return;
  }

  const persistenceCode = getErrorCode(error);
  if (persistenceCode === 'P2002') {
    response.status(409).json({ error: { code: 'CONFLICT', message: 'Ya existe un registro con esos datos.' } });
    return;
  }
  if (persistenceCode === 'P2025') {
    response.status(404).json({ error: { code: 'NOT_FOUND', message: 'El registro solicitado no existe.' } });
    return;
  }

  console.error('Error no controlado en la API:', error);
  response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error interno.' } });
};

function getErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  return typeof error.code === 'string' ? error.code : undefined;
}
