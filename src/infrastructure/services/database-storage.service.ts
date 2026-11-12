import { FileStorageError, type FileToUpload, type IFileStorage } from '../../domain/services/IFileStorage.js';
import type { IStoredFileRepository } from '../../domain/repository/IStoredFile.repository.js';
import { logger } from '../logger.js';

/** Prefijo de las URLs de los archivos guardados en la base de datos: `/api/archivos/<id>`. */
export const STORED_FILE_URL_PREFIX = '/api/archivos/';

/**
 * Fallback de almacenamiento: guarda los bytes en Postgres, así que sobrevive a los reinicios
 * y redespliegues del servicio (a diferencia del disco local de Render). La URL es relativa a la
 * API; el frontend la resuelve contra `NEXT_PUBLIC_API_HOST`.
 */
export class DatabaseFileStorage implements IFileStorage {
  constructor(private readonly files: IStoredFileRepository) {}

  async upload(file: FileToUpload): Promise<string> {
    try {
      const id = await this.files.create({ mimeType: file.mimeType, content: file.content });
      return `${STORED_FILE_URL_PREFIX}${id}`;
    } catch (error) {
      logger.error('No se pudo guardar una imagen en la base de datos.', error);
      throw new FileStorageError('UPLOAD_FAILED', 'No se pudo guardar el archivo.');
    }
  }

  async remove(url: string): Promise<void> {
    if (!url.startsWith(STORED_FILE_URL_PREFIX)) return;
    await this.files.delete(url.slice(STORED_FILE_URL_PREFIX.length));
  }
}
