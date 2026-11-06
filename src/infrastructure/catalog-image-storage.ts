import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { ApplicationError } from '../domain/errors.js';
import { config } from './config.js';

const allowedExtensions: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export async function uploadCatalogImage(
  catalogItemId: string,
  image: { buffer: Buffer; mimetype: string },
) {
  const extension = allowedExtensions[image.mimetype];
  if (!extension) {
    throw new ApplicationError(415, 'UNSUPPORTED_IMAGE_TYPE', 'Usa una imagen JPG, PNG o WebP.');
  }
  if (!hasValidSignature(image.buffer, image.mimetype)) {
    throw new ApplicationError(400, 'INVALID_IMAGE', 'El archivo no contiene una imagen válida.');
  }
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    throw new ApplicationError(
      503,
      'IMAGE_STORAGE_NOT_CONFIGURED',
      'Configura SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY para habilitar la carga de imágenes.',
    );
  }

  const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const path = `${catalogItemId}/${randomUUID()}${extension}`;
  const { error } = await supabase.storage
    .from(config.supabaseStorageBucket)
    .upload(path, image.buffer, {
      contentType: image.mimetype,
      cacheControl: '3600',
      upsert: false,
    });
  if (error) {
    console.error('Falló la carga de una imagen a Supabase Storage:', error);
    throw new ApplicationError(502, 'IMAGE_UPLOAD_FAILED', 'No se pudo guardar la imagen en el almacenamiento.');
  }
  const { data } = supabase.storage.from(config.supabaseStorageBucket).getPublicUrl(path);
  return data.publicUrl;
}

function hasValidSignature(buffer: Buffer, mimeType: string) {
  if (mimeType === 'image/jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === 'image/png') {
    return buffer.length >= 8
      && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  return mimeType === 'image/webp'
    && buffer.length >= 12
    && buffer.toString('ascii', 0, 4) === 'RIFF'
    && buffer.toString('ascii', 8, 12) === 'WEBP';
}
