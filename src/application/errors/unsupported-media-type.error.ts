import { ApplicationError } from './application.error.js';

export class UnsupportedMediaTypeError extends ApplicationError {
  constructor(message: string) {
    super(415, 'UNSUPPORTED_MEDIA_TYPE', message);
  }
}
