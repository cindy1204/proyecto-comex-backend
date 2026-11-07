import type { Request, RequestHandler } from 'express';
import multer from 'multer';
import { BadRequestError } from '../../application/errors/bad-request.error.js';
import { PayloadTooLargeError } from '../../application/errors/payload-too-large.error.js';
import { MAX_IMAGE_BYTES } from '../../application/image-validation.js';
import type { FileToUpload } from '../../domain/services/IFileStorage.js';

export const IMAGE_FIELD = 'image';

/**
 * multer lee `multipart/form-data` en memoria (el disco del servidor no persiste entre despliegues).
 * El límite se aplica mientras llega el archivo; el tipo y la firma de bytes se validan en el caso de uso.
 * Con JSON no hace nada y deja pasar el body.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
});

const singleImage = upload.single(IMAGE_FIELD);

export const uploadImage: RequestHandler = (request, response, next) => {
  singleImage(request, response, (error: unknown) => {
    if (!error) {
      next();
      return;
    }
    next(translateUploadError(error));
  });
};

function translateUploadError(error: unknown): Error {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') return new PayloadTooLargeError('La imagen supera el tamaño máximo de 5 MB.');
    if (error.code === 'LIMIT_UNEXPECTED_FILE' || error.code === 'LIMIT_FILE_COUNT') {
      return new BadRequestError(
        `Envía como máximo un archivo en el campo "${IMAGE_FIELD}".`,
        undefined,
        'INVALID_UPLOAD',
      );
    }
    return new BadRequestError('No se pudo procesar el archivo enviado.', undefined, 'INVALID_UPLOAD');
  }
  if (error instanceof Error) {
    return new BadRequestError('El formulario multipart no es válido.', undefined, 'INVALID_UPLOAD');
  }
  return new BadRequestError('No se pudo procesar el archivo enviado.', undefined, 'INVALID_UPLOAD');
}

/** Convierte el archivo de multer al tipo del dominio: la capa de aplicación no depende de multer. */
export function getUploadedImage(request: Request): FileToUpload | undefined {
  const file = request.file;
  if (!file) return undefined;
  return {
    content: file.buffer,
    mimeType: file.mimetype,
    size: file.size,
    originalName: file.originalname,
  };
}
