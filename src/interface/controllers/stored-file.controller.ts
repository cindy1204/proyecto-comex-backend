import type { Request, Response } from 'express';
import type { StoredFileUseCase } from '../../application/use-cases/stored-file.use-case.js';
import { idParamsSchema } from '../../infrastructure/dtos/shared.dto.js';

export class StoredFileController {
  constructor(private readonly files: StoredFileUseCase) {}

  get = async (request: Request, response: Response): Promise<void> => {
    const { id } = idParamsSchema.parse(request.params);
    const file = await this.files.get(id);
    response.set({
      'Content-Type': file.mimeType,
      'Cache-Control': 'public, max-age=86400',
      // Helmet fija `same-origin`; las imágenes se muestran desde el frontend (otro origen).
      'Cross-Origin-Resource-Policy': 'cross-origin',
    });
    response.status(200).send(Buffer.from(file.content));
  };
}
