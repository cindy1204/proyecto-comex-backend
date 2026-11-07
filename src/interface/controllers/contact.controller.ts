import type { Request, Response } from 'express';
import type { ContactUseCase } from '../../application/use-cases/contact.use-case.js';
import {
  parseContactCreateBody,
  parseContactListQuery,
  parseContactUpdateBody,
} from '../../infrastructure/dtos/contact.dto.js';
import { idParamsSchema } from '../../infrastructure/dtos/shared.dto.js';
import { requireUser } from '../middlewares/auth.middleware.js';

export class ContactController {
  constructor(private readonly contacts: ContactUseCase) {}

  create = async (request: Request, response: Response): Promise<void> => {
    const created = await this.contacts.create(parseContactCreateBody(request.body), request.auth);
    response.status(201).json({ data: created });
  };

  listAll = async (request: Request, response: Response): Promise<void> => {
    response.status(200).json(await this.contacts.listAll(parseContactListQuery(request.query)));
  };

  listMine = async (request: Request, response: Response): Promise<void> => {
    const result = await this.contacts.listMine(requireUser(request), parseContactListQuery(request.query));
    response.status(200).json(result);
  };

  getById = async (request: Request, response: Response): Promise<void> => {
    const { id } = idParamsSchema.parse(request.params);
    response.status(200).json({ data: await this.contacts.getById(requireUser(request), id) });
  };

  update = async (request: Request, response: Response): Promise<void> => {
    const { id } = idParamsSchema.parse(request.params);
    const updated = await this.contacts.update(requireUser(request), id, parseContactUpdateBody(request.body));
    response.status(200).json({ data: updated });
  };

  remove = async (request: Request, response: Response): Promise<void> => {
    const { id } = idParamsSchema.parse(request.params);
    await this.contacts.remove(requireUser(request), id);
    response.status(204).end();
  };
}
