import { Prisma, PrismaClient, UserRole } from '@prisma/client';
import { BcryptPasswordHasher } from '../infrastructure/services/bcrypt.service.js';
import { logger } from '../infrastructure/logger.js';

const ADMIN_EMAIL = 'admin@colcomex.com';
const passwords = new BcryptPasswordHasher();

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} es obligatorio.`);
  }
  return value;
}

async function createAdmin(): Promise<void> {
  const email = requiredEnv('SEED_ADMIN_EMAIL').toLowerCase();
  const name = requiredEnv('SEED_ADMIN_NAME');
  const password = process.env.SEED_ADMIN_PASSWORD;
  const confirmation = process.env.ADMIN_CREATE_CONFIRM;

  if (email !== ADMIN_EMAIL) {
    throw new Error(`SEED_ADMIN_EMAIL debe ser ${ADMIN_EMAIL}.`);
  }
  if (!password || password.length < 12) {
    throw new Error('SEED_ADMIN_PASSWORD es obligatorio y requiere al menos 12 caracteres.');
  }
  if (confirmation !== `CREATE_ADMIN:${ADMIN_EMAIL}`) {
    throw new Error(`Confirma la operación con ADMIN_CREATE_CONFIRM=CREATE_ADMIN:${ADMIN_EMAIL}.`);
  }

  const prisma = new PrismaClient();
  try {
    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: await passwords.hash(password),
        role: UserRole.ADMIN,
      },
    });

    logger.info(`Cuenta administradora creada: ${email}`);
  } finally {
    await prisma.$disconnect();
  }
}

try {
  await createAdmin();
} catch (error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    logger.error(`No se creó la cuenta: ${ADMIN_EMAIL} ya existe. No se modificó ningún usuario.`);
  } else {
    logger.error(
      'No se pudo crear la cuenta administradora.',
      error instanceof Error ? error.message : 'Error desconocido.',
    );
  }
  process.exitCode = 1;
}
