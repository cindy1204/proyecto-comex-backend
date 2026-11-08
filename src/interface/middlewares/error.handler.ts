import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { ApplicationError, type ErrorDetail } from '../../application/errors/application.error.js';
import { NotFoundError } from '../../application/errors/not-found.error.js';
import { logger } from '../../infrastructure/logger.js';

interface ErrorBody {
  status: number;
  code: string;
  message: string;
  details?: ErrorDetail[];
}

export const notFound: RequestHandler = (_request, _response, next) => {
  next(new NotFoundError('La ruta solicitada no existe.'));
};

/** Convierte cualquier error en `{ error: { code, message, details? } }`; el stack nunca sale en la respuesta. */
export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  const body = describeError(error);
  if (body.status >= 500) logger.error('Error no controlado en la API.', error);

  response.status(body.status).json({
    error: { code: body.code, message: body.message, ...(body.details ? { details: body.details } : {}) },
  });
};

function describeError(error: unknown): ErrorBody {
  if (error instanceof ApplicationError) {
    return { status: error.status, code: error.code, message: error.message, details: error.details };
  }
  if (error instanceof ZodError) {
    return {
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Revisa los datos enviados.',
      details: error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
    };
  }
  if (error instanceof URIError) {
    return { status: 400, code: 'BAD_REQUEST', message: 'La dirección solicitada contiene caracteres no válidos.' };
  }

  const httpStatus = readHttpStatus(error);
  if (httpStatus !== undefined) return describeHttpError(error, httpStatus);

  const persistenceCode = readString(error, 'code');
  switch (persistenceCode) {
    case 'P2000':
      return { status: 400, code: 'VALIDATION_ERROR', message: 'Uno de los valores enviados es demasiado largo.' };
    case 'P2002':
      return { status: 409, code: 'CONFLICT', message: 'Ya existe un registro con esos datos.' };
    case 'P2003':
      return { status: 409, code: 'CONFLICT', message: 'El registro depende de otro que no existe o sigue en uso.' };
    case 'P2025':
      return { status: 404, code: 'NOT_FOUND', message: 'El registro solicitado no existe.' };
    default:
      return { status: 500, code: 'INTERNAL_ERROR', message: 'Ocurrió un error interno.' };
  }
}

/** Errores generados por Express/body-parser (JSON inválido, cuerpo grande, parámetros mal codificados). */
function describeHttpError(error: unknown, status: number): ErrorBody {
  const type = readString(error, 'type');
  if (type === 'entity.parse.failed') {
    return { status: 400, code: 'INVALID_JSON', message: 'El cuerpo de la petición no contiene JSON válido.' };
  }
  if (status === 413) {
    return { status, code: 'PAYLOAD_TOO_LARGE', message: 'El cuerpo de la petición supera el tamaño permitido.' };
  }
  if (status === 415) {
    return { status, code: 'UNSUPPORTED_MEDIA_TYPE', message: 'El tipo de contenido no es compatible.' };
  }
  return { status, code: 'BAD_REQUEST', message: 'La petición no es válida.' };
}

function readHttpStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const status = 'status' in error ? error.status : 'statusCode' in error ? error.statusCode : undefined;
  return typeof status === 'number' && status >= 400 && status < 500 ? status : undefined;
}

function readString(error: unknown, key: string): string | undefined {
  if (typeof error !== 'object' || error === null || !(key in error)) return undefined;
  const value = (error as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
}
