import type { Request, Response } from 'express';
import type { InteractionsUseCase } from '../../application/use-cases/interactions.use-case.js';
import {
  parseInteractionCreateBody,
  parseInteractionListQuery,
  parseInteractionUpdateBody,
  parseMyInteractionsQuery,
} from '../../infrastructure/dtos/interaction.dto.js';
import { idParamsSchema } from '../../infrastructure/dtos/shared.dto.js';
import { requireUser } from '../middlewares/auth.middleware.js';

export class InteractionsController {
  constructor(private readonly interactions: InteractionsUseCase) {}

  create = async (request: Request, response: Response): Promise<void> => {
    const created = await this.interactions.create(requireUser(request), parseInteractionCreateBody(request.body));
    response.status(201).json({ data: created });
  };

  listAll = async (request: Request, response: Response): Promise<void> => {
    const result = await this.interactions.listAll(requireUser(request), parseInteractionListQuery(request.query));
    response.status(200).json(result);
  };

  listMine = async (request: Request, response: Response): Promise<void> => {
    const result = await this.interactions.listMine(requireUser(request), parseMyInteractionsQuery(request.query));
    response.status(200).json(result);
  };

  getById = async (request: Request, response: Response): Promise<void> => {
    const { id } = idParamsSchema.parse(request.params);
    response.status(200).json({ data: await this.interactions.getById(requireUser(request), id) });
  };

  update = async (request: Request, response: Response): Promise<void> => {
    const { id } = idParamsSchema.parse(request.params);
    const updated = await this.interactions.update(requireUser(request), id, parseInteractionUpdateBody(request.body));
    response.status(200).json({ data: updated });
  };

  remove = async (request: Request, response: Response): Promise<void> => {
    const { id } = idParamsSchema.parse(request.params);
    await this.interactions.remove(requireUser(request), id);
    response.status(204).end();
  };
}
