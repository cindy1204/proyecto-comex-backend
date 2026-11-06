import type { FileToUpload } from '../domain/services/IFileStorage.js';
import { BadRequestError } from './errors/bad-request.error.js';
import { PayloadTooLargeError } from './errors/payload-too-large.error.js';
import { UnsupportedMediaTypeError } from './errors/unsupported-media-type.error.js';

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Valida tipo declarado, tamaño y firma de bytes: el tipo MIME enviado por el cliente no basta. */
export function assertValidImage(file: FileToUpload): void {
  if (!ALLOWED_IMAGE_TYPES.some((type) => type === file.mimeType)) {
    throw new UnsupportedMediaTypeError('Usa una imagen JPG, PNG o WebP.');
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new PayloadTooLargeError('La imagen supera el tamaño máximo de 5 MB.');
  }
  if (!hasValidSignature(Buffer.from(file.content), file.mimeType)) {
    throw new BadRequestError('El archivo no contiene una imagen válida.', undefined, 'INVALID_IMAGE');
  }
}

function hasValidSignature(content: Buffer, mimeType: string): boolean {
  switch (mimeType) {
    case 'image/jpeg':
      return content.length >= 3 && content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff;
    case 'image/png':
      return content.length >= 8 && content.subarray(0, 8).equals(PNG_SIGNATURE);
    case 'image/webp':
      return (
        content.length >= 12 &&
        content.toString('ascii', 0, 4) === 'RIFF' &&
        content.toString('ascii', 8, 12) === 'WEBP'
      );
    default:
      return false;
  }
}
