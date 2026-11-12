import type { FileToUpload, IFileStorage } from '../../domain/services/IFileStorage.js';
import { STORED_FILE_URL_PREFIX } from './database-storage.service.js';

/** Almacenamiento remoto (Supabase) que puede no estar configurado. */
export interface RemoteFileStorage extends IFileStorage {
  isConfigured(): boolean;
}

/**
 * Elige el destino de cada archivo: Supabase Storage si está configurado; si no, la base de datos.
 * Al borrar, la URL decide el destino, así que las imágenes ya guardadas siguen borrándose
 * aunque cambie la configuración.
 */
export class RoutedFileStorage implements IFileStorage {
  constructor(
    private readonly remote: RemoteFileStorage,
    private readonly local: IFileStorage,
  ) {}

  upload(file: FileToUpload, folder: string): Promise<string> {
    return this.remote.isConfigured() ? this.remote.upload(file, folder) : this.local.upload(file, folder);
  }

  remove(url: string): Promise<void> {
    return url.startsWith(STORED_FILE_URL_PREFIX) ? this.local.remove(url) : this.remote.remove(url);
  }
}
