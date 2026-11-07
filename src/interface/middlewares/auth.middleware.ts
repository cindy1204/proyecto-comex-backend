import type { Request, RequestHandler } from 'express';
import { ForbiddenError } from '../../application/errors/forbidden.error.js';
import { UnauthorizedError } from '../../application/errors/unauthorized.error.js';
import type { AuthUseCase } from '../../application/use-cases/auth.use-case.js';
import type { AuthenticatedUser, UserRole } from '../../domain/models/user.model.js';

declare module 'express-serve-static-core' {
  interface Request {
    /** Usuario autenticado; lo completan `authenticate` y `optionalAuthenticate`. */
    auth?: AuthenticatedUser;
  }
}

export interface Guards {
  authenticate: RequestHandler;
  optionalAuthenticate: RequestHandler;
  requireAdmin: RequestHandler;
}

const BEARER_PATTERN = /^Bearer\s+(\S+)$/i;

function readBearerToken(request: Request): string {
  const header = request.headers.authorization;
  if (!header) throw new UnauthorizedError();
  const token = BEARER_PATTERN.exec(header)?.[1];
  if (!token) {
    throw new UnauthorizedError('El encabezado Authorization debe tener el formato "Bearer <token>".');
  }
  return token;
}

/** Autenticación: ¿quién eres? Sin token, formato inválido o token inválido/expirado responde 401. */
export function createAuthenticate(auth: AuthUseCase): RequestHandler {
  return async (request, _response, next) => {
    try {
      request.auth = await auth.authenticate(readBearerToken(request));
      next();
    } catch (error) {
      next(error);
    }
  };
}

/** Sin encabezado Authorization continúa como visitante; si lo trae, debe ser válido. */
export function createOptionalAuthenticate(auth: AuthUseCase): RequestHandler {
  const authenticate = createAuthenticate(auth);
  return (request, response, next) => {
    if (request.headers.authorization === undefined) {
      next();
      return;
    }
    return authenticate(request, response, next);
  };
}

/** Autorización: ¿puedes hacer esto? Se usa después de `authenticate`; un rol sin permiso responde 403. */
export function authorize(...roles: UserRole[]): RequestHandler {
  return (request, _response, next) => {
    if (!request.auth) {
      next(new UnauthorizedError());
      return;
    }
    if (!roles.includes(request.auth.role)) {
      next(new ForbiddenError());
      return;
    }
    next();
  };
}

export function createGuards(auth: AuthUseCase): Guards {
  return {
    authenticate: createAuthenticate(auth),
    optionalAuthenticate: createOptionalAuthenticate(auth),
    requireAdmin: authorize('admin'),
  };
}

/** Usuario autenticado de la petición, para controladores de rutas protegidas. */
export function requireUser(request: Request): AuthenticatedUser {
  if (!request.auth) throw new UnauthorizedError();
  return request.auth;
}
