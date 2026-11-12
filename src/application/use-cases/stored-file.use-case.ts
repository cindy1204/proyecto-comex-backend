import type { IStoredFileRepository, StoredFile } from '../../domain/repository/IStoredFile.repository.js';
import { NotFoundError } from '../errors/not-found.error.js';

export class StoredFileUseCase {
  constructor(private readonly files: IStoredFileRepository) {}

  async get(id: string): Promise<StoredFile> {
    const file = await this.files.findById(id);
    if (!file) throw new NotFoundError('La imagen no existe.');
    return file;
  }
}
