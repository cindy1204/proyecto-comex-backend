import { ApplicationError } from './application.error.js';

export class ServiceUnavailableError extends ApplicationError {
  constructor(message: string, code = 'SERVICE_UNAVAILABLE') {
    super(503, code, message);
  }
}
