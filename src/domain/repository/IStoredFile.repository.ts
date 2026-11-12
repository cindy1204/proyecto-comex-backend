export interface NewStoredFile {
  mimeType: string;
  content: Uint8Array;
}

export interface StoredFile extends NewStoredFile {
  id: string;
}

/** Archivos guardados en la base de datos (fallback cuando no hay Supabase Storage). */
export interface IStoredFileRepository {
  /** Guarda el archivo y devuelve su identificador. */
  create(file: NewStoredFile): Promise<string>;
  findById(id: string): Promise<StoredFile | null>;
  /** No falla si el archivo no existe. */
  delete(id: string): Promise<void>;
}
