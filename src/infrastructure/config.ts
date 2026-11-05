import 'dotenv/config';
import { z } from 'zod';

const configSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.coerce.number().int().positive().default(3600),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
});

const result = configSchema.safeParse(process.env);

if (!result.success) {
  const issues = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
  throw new Error(`Configuración de entorno inválida: ${issues}`);
}

export const config = {
  databaseUrl: result.data.DATABASE_URL,
  jwtSecret: result.data.JWT_SECRET,
  jwtExpiresInSeconds: result.data.JWT_EXPIRES_IN,
  port: result.data.PORT,
  corsOrigins: result.data.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean),
};
