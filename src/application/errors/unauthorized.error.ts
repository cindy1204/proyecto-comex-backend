import { ApplicationError } from './application.error.js';

export class UnauthorizedError extends ApplicationError {
  constructor(message = 'Debes iniciar sesión para realizar esta acción.', code = 'UNAUTHORIZED') {
    super(401, code, message);
  }
}
