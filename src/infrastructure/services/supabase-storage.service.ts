import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { FileStorageError, type FileToUpload, type IFileStorage } from '../../domain/services/IFileStorage.js';
import { logger } from '../logger.js';

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export interface SupabaseStorageOptions {
  url: string | undefined;
  serviceRoleKey: string | undefined;
  bucket: string;
}

/**
 * Supabase Storage es el bucket S3 del proyecto. El cliente se crea en el primer uso:
 * si faltan las credenciales la API arranca igual y solo falla la carga de imágenes.
 */
export class SupabaseStorageService implements IFileStorage {
  private client: SupabaseClient | null = null;

  constructor(private readonly options: SupabaseStorageOptions) {}

  async upload(file: FileToUpload, folder: string): Promise<string> {
    const client = this.getClient();
    // La extensión sale del tipo MIME validado, nunca del nombre que envió el usuario.
    const path = `${folder}/${randomUUID()}${EXTENSIONS[file.mimeType] ?? ''}`;
    const bucket = client.storage.from(this.options.bucket);

    const { error } = await bucket.upload(path, file.content, {
      contentType: file.mimeType,
      cacheControl: '3600',
      upsert: false,
    });
    if (error) {
      logger.error('Falló la carga de una imagen a Supabase Storage.', error);
      throw new FileStorageError('UPLOAD_FAILED', 'No se pudo guardar el archivo.');
    }
    return bucket.getPublicUrl(path).data.publicUrl;
  }

  async remove(url: string): Promise<void> {
    if (!this.isConfigured()) return;
    const bucket = this.getClient().storage.from(this.options.bucket);
    const prefix = bucket.getPublicUrl('').data.publicUrl;
    // Solo se borran archivos de este bucket: una URL externa se ignora.
    if (!url.startsWith(prefix)) return;

    const { error } = await bucket.remove([decodeURIComponent(url.slice(prefix.length))]);
    if (error) logger.error('No se pudo borrar una imagen de Supabase Storage.', error);
  }

  isConfigured(): boolean {
    return Boolean(this.options.url && this.options.serviceRoleKey);
  }

  private getClient(): SupabaseClient {
    if (!this.options.url || !this.options.serviceRoleKey) {
      throw new FileStorageError('NOT_CONFIGURED', 'Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.');
    }
    this.client ??= createClient(this.options.url, this.options.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    return this.client;
  }
}
