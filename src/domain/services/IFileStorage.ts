export interface FileToUpload {
  content: Uint8Array;
  mimeType: string;
  size: number;
  originalName: string;
}

export type FileStorageFailure = 'NOT_CONFIGURED' | 'UPLOAD_FAILED';

export class FileStorageError extends Error {
  constructor(
    readonly reason: FileStorageFailure,
    message: string,
  ) {
    super(message);
    this.name = 'FileStorageError';
  }
}

/**
 * Almacenamiento de archivos. La capa de aplicación solo conoce esta interfaz;
 * hoy la implementa un bucket S3 de Supabase Storage.
 */
export interface IFileStorage {
  /** Sube el archivo a la carpeta indicada y devuelve su URL pública. */
  upload(file: FileToUpload, folder: string): Promise<string>;
  /** Borra un archivo a partir de la URL pública que devolvió `upload`. No falla si no existe. */
  remove(url: string): Promise<void>;
}
