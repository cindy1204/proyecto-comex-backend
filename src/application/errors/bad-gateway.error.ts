import { ApplicationError } from './application.error.js';

export class BadGatewayError extends ApplicationError {
  constructor(message: string, code = 'BAD_GATEWAY') {
    super(502, code, message);
  }
}
