import type { Request, Response } from 'express';
import type { AuthUseCase } from '../../application/use-cases/auth.use-case.js';
import { parseAdminBody, parseLoginBody, parseRegisterBody } from '../../infrastructure/dtos/auth.dto.js';
import { requireUser } from '../middlewares/auth.middleware.js';

export class AuthController {
  constructor(private readonly auth: AuthUseCase) {}

  register = async (request: Request, response: Response): Promise<void> => {
    const session = await this.auth.register(parseRegisterBody(request.body));
    response.status(201).json({ data: session });
  };

  login = async (request: Request, response: Response): Promise<void> => {
    const session = await this.auth.login(parseLoginBody(request.body));
    response.status(200).json({ data: session });
  };

  me = async (request: Request, response: Response): Promise<void> => {
    const user = await this.auth.getProfile(requireUser(request).id);
    response.status(200).json({ data: user });
  };

  registerAdmin = async (request: Request, response: Response): Promise<void> => {
    const user = await this.auth.registerAdmin(parseAdminBody(request.body));
    response.status(201).json({ data: user });
  };
}
