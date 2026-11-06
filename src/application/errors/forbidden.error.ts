import { ApplicationError } from './application.error.js';

export class ForbiddenError extends ApplicationError {
  constructor(message = 'No tienes permiso para realizar esta acción.') {
    super(403, 'FORBIDDEN', message);
  }
}
