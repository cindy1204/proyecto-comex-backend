import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import type { RequestHandler } from 'express';

const MINUTE = 60 * 1000;

export interface RateLimits {
  /** Peticiones por IP y 15 minutos para toda la API. */
  api: number;
  /** Intentos fallidos de login/registro por IP y 15 minutos. */
  auth: number;
  /** Solicitudes de contacto por IP y 15 minutos. */
  contact: number;
  /** Escrituras del catálogo (con o sin imagen) por usuario y hora. */
  upload: number;
}

export const DEFAULT_RATE_LIMITS: RateLimits = { api: 300, auth: 20, contact: 10, upload: 60 };

export interface RateLimiters {
  api: RequestHandler;
  auth: RequestHandler;
  contact: RequestHandler;
  upload: RequestHandler;
}

function limiter(message: string, windowMs: number, limit: number, extra: Parameters<typeof rateLimit>[0] = {}) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message } },
    ...extra,
  });
}

/** Los contadores viven en la memoria del proceso: con varias instancias cada una lleva su propia cuenta. */
export function createRateLimiters(limits: RateLimits = DEFAULT_RATE_LIMITS): RateLimiters {
  return {
    api: limiter('Hiciste demasiadas peticiones. Intenta más tarde.', 15 * MINUTE, limits.api),
    auth: limiter('Demasiados intentos fallidos. Intenta más tarde.', 15 * MINUTE, limits.auth, {
      skipSuccessfulRequests: true,
    }),
    contact: limiter('Enviaste demasiadas solicitudes de contacto. Intenta más tarde.', 15 * MINUTE, limits.contact),
    upload: limiter('Alcanzaste el límite de cambios al catálogo por hora.', 60 * MINUTE, limits.upload, {
      keyGenerator: (request) => (request.auth ? `user-${request.auth.id}` : ipKeyGenerator(request.ip ?? '')),
    }),
  };
}
