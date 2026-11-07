import { z } from 'zod';
import type { Credentials, Registration } from '../../application/use-cases/auth.use-case.js';
import { emailField, text } from './shared.dto.js';

const MAX_PASSWORD_BYTES = 72;

const password = (min: number) =>
  z
    .string()
    .min(min)
    .refine(
      (value) => Buffer.byteLength(value) <= MAX_PASSWORD_BYTES,
      `La contraseña no puede superar ${MAX_PASSWORD_BYTES} bytes.`,
    )
    .refine((value) => !value.includes('\u0000'), 'No puede contener caracteres nulos.');

const registerSchema = z.object({
  name: text(2, 120),
  email: emailField,
  password: password(8),
});

const adminSchema = z.object({
  name: text(2, 120),
  email: emailField,
  password: password(12),
});

const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'La contraseña es obligatoria.').max(1024),
});

export const parseRegisterBody = (body: unknown): Registration => registerSchema.parse(body);
export const parseAdminBody = (body: unknown): Registration => adminSchema.parse(body);
export const parseLoginBody = (body: unknown): Credentials => loginSchema.parse(body);
