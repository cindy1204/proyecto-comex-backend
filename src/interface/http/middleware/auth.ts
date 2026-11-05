import type { NextFunction, Request, Response } from 'express';
import type { AuthService } from '../../../application/auth-service.js';
import { HttpError } from './errors.js';

export function createAuthenticate(authService: AuthService) {
  return async (request: Request, _response: Response, next: NextFunction) => {
    const token = request.header('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) {
      return next(new HttpError(401, 'UNAUTHORIZED', 'Debes iniciar sesión para realizar esta acción.'));
    }

    try {
      const identity = authService.authenticate(token);
      const currentUser = await authService.getCurrentUser(identity.id);
      request.auth = { userId: currentUser.id, role: currentUser.role };
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function createOptionalAuthenticate(authService: AuthService) {
  return async (request: Request, _response: Response, next: NextFunction) => {
    const authorization = request.header('authorization');
    if (!authorization) {
      next();
      return;
    }

    const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) {
      next(new HttpError(401, 'UNAUTHORIZED', 'El encabezado de autenticación no es válido.'));
      return;
    }

    try {
      const identity = authService.authenticate(token);
      const currentUser = await authService.getCurrentUser(identity.id);
      request.auth = { userId: currentUser.id, role: currentUser.role };
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireAdmin(request: Request, _response: Response, next: NextFunction) {
  if (request.auth?.role !== 'admin') {
    return next(new HttpError(403, 'FORBIDDEN', 'No tienes permiso para realizar esta acción.'));
  }
  next();
}
