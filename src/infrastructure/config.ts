import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'debe tener al menos 32 caracteres'),
  JWT_EXPIRES_IN: z.coerce.number().int().positive(),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  SUPABASE_URL: z.url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  SUPABASE_STORAGE_BUCKET: z.string().min(1).default('catalogo'),
});

export interface AppConfig {
  databaseUrl: string;
  jwtSecret: string;
  jwtExpiresInSeconds: number;
  port: number;
  corsOrigins: string[];
  supabase: {
    url: string | undefined;
    serviceRoleKey: string | undefined;
    bucket: string;
  };
}

/** Valida las variables de entorno; el mensaje de error nombra las variables, nunca sus valores. */
export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const emptyAsMissing = Object.fromEntries(Object.entries(env).filter(([, value]) => value !== ''));
  const result = envSchema.safeParse(emptyAsMissing);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`Configuración de entorno inválida: ${issues}`);
  }

  const values = result.data;
  return {
    databaseUrl: values.DATABASE_URL,
    jwtSecret: values.JWT_SECRET,
    jwtExpiresInSeconds: values.JWT_EXPIRES_IN,
    port: values.PORT,
    corsOrigins: values.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    supabase: {
      url: values.SUPABASE_URL,
      serviceRoleKey: values.SUPABASE_SERVICE_ROLE_KEY,
      bucket: values.SUPABASE_STORAGE_BUCKET,
    },
  };
}
