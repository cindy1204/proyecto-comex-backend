import type { Request, Response } from 'express';
import type { CatalogUseCase } from '../../application/use-cases/catalog.use-case.js';
import {
  parseCatalogCreateBody,
  parseCatalogListQuery,
  parseCatalogUpdateBody,
} from '../../infrastructure/dtos/catalog.dto.js';
import { idParamsSchema } from '../../infrastructure/dtos/shared.dto.js';
import { getUploadedImage } from '../middlewares/upload.middleware.js';

export class CatalogController {
  constructor(private readonly catalog: CatalogUseCase) {}

  list = async (request: Request, response: Response): Promise<void> => {
    const result = await this.catalog.list(parseCatalogListQuery(request.query), request.auth);
    response.status(200).json(result);
  };

  getById = async (request: Request, response: Response): Promise<void> => {
    const { id } = idParamsSchema.parse(request.params);
    response.status(200).json({ data: await this.catalog.getById(id, request.auth) });
  };

  create = async (request: Request, response: Response): Promise<void> => {
    const item = await this.catalog.create(parseCatalogCreateBody(request.body), getUploadedImage(request));
    response.status(201).json({ data: item });
  };

  update = async (request: Request, response: Response): Promise<void> => {
    const { id } = idParamsSchema.parse(request.params);
    const item = await this.catalog.update(id, parseCatalogUpdateBody(request.body), getUploadedImage(request));
    response.status(200).json({ data: item });
  };

  remove = async (request: Request, response: Response): Promise<void> => {
    const { id } = idParamsSchema.parse(request.params);
    await this.catalog.remove(id);
    response.status(204).end();
  };
}
