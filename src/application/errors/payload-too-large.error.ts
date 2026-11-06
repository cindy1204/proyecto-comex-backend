import { ApplicationError } from './application.error.js';

export class PayloadTooLargeError extends ApplicationError {
  constructor(message: string) {
    super(413, 'PAYLOAD_TOO_LARGE', message);
  }
}
