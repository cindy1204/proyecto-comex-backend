import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import multer from 'multer';
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

  if (error instanceof multer.MulterError) {
    const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    response.status(status).json({
      error: {
        code: error.code,
        message: status === 413 ? 'La imagen supera el tamaño máximo de 5 MB.' : 'No se pudo procesar el archivo enviado.',
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

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const persistenceError = getPersistenceError(error.code);
    if (persistenceError) {
      response.status(persistenceError.status).json({
        error: { code: persistenceError.code, message: persistenceError.message },
      });
      return;
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    response.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Los datos enviados no son válidos.' },
    });
    return;
  }

  console.error('Error no controlado en la API:', error);
  response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error interno.' } });
};

function getPersistenceError(code: string): { status: number; code: string; message: string } | null {
  switch (code) {
    case 'P2000':
    case 'P2006':
    case 'P2011':
    case 'P2012':
    case 'P2023':
      return {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Uno o más datos enviados no son válidos.',
      };
    case 'P2002':
      return { status: 409, code: 'CONFLICT', message: 'Ya existe un registro con esos datos.' };
    case 'P2003':
      return {
        status: 400,
        code: 'RELATED_RECORD_NOT_FOUND',
        message: 'Uno de los registros relacionados no existe.',
      };
    case 'P2014':
      return { status: 409, code: 'RELATION_CONFLICT', message: 'La operación no es válida por sus relaciones.' };
    case 'P2025':
      return { status: 404, code: 'NOT_FOUND', message: 'El registro solicitado no existe.' };
    default:
      return null;
  }
}
