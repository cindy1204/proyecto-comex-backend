import { BadRequestError } from './errors/bad-request.error.js';

export function assertHasChanges(changes: object, hasFile = false): void {
  if (!hasFile && Object.values(changes).every((value) => value === undefined)) {
    throw new BadRequestError('Envía por lo menos un campo para actualizar.');
  }
}
