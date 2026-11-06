import { ApplicationError, type ErrorDetail } from './application.error.js';

export class BadRequestError extends ApplicationError {
  constructor(message: string, details?: ErrorDetail[], code = 'VALIDATION_ERROR') {
    super(400, code, message, details);
  }
}
