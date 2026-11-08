import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PrismaClient, type Prisma } from '@prisma/client';
import { logger } from '../src/infrastructure/logger.js';
import { BcryptPasswordHasher } from '../src/infrastructure/services/bcrypt.service.js';

/** Cuentas de demostración documentadas en el README; cada valor se puede sustituir con variables SEED_*. */
const DEFAULT_ACCOUNTS = {
  admin: { name: 'Administrador', email: 'admin@colcomex.com', password: 'Admin#2026' },
  user: { name: 'Usuario de prueba', email: 'usuario@colcomex.com', password: 'Usuario#2026' },
} as const;

type CatalogEntry = [code: string, title: string, description: string, note?: string];
type CatalogGroup = Record<string, CatalogEntry[]>;
type CatalogFile = Record<string, CatalogGroup>;

const prisma = new PrismaClient();
const passwords = new BcryptPasswordHasher();

async function readJson<T>(relativePath: string): Promise<T> {
  return JSON.parse(await readFile(resolve(process.cwd(), relativePath), 'utf8')) as T;
}

/**
 * Inserta solo los numerales que aún no existen: no pisa ediciones hechas por un administrador
 * ni reactiva numerales removidos, así que se puede ejecutar en cada despliegue.
 */
async function seedCatalog(): Promise<void> {
  const catalog = await readJson<CatalogFile>('prisma/data/catalogo.json');
  catalog.servicios = await readJson<CatalogGroup>('prisma/data/servicios.json');

  const rows: Prisma.CatalogItemCreateManyInput[] = [];
  for (const [category, directions] of Object.entries(catalog)) {
    for (const [direction, entries] of Object.entries(directions)) {
      for (const [code, title, description, note] of entries) {
        rows.push({
          category,
          direction: direction === 'ingresos' ? 'INGRESOS' : 'EGRESOS',
          code,
          title,
          description,
          note: note ?? null,
        });
      }
    }
  }

  const { count } = await prisma.catalogItem.createMany({ data: rows, skipDuplicates: true });
  logger.info(`Catálogo: ${count} numerales nuevos de ${rows.length} en los archivos de datos.`);
}

async function seedAccount(role: 'ADMIN' | 'USER', prefix: 'SEED_ADMIN' | 'SEED_USER'): Promise<void> {
  const defaults = role === 'ADMIN' ? DEFAULT_ACCOUNTS.admin : DEFAULT_ACCOUNTS.user;
  const email = (process.env[`${prefix}_EMAIL`]?.trim() || defaults.email).toLowerCase();
  const name = process.env[`${prefix}_NAME`]?.trim() || defaults.name;
  const password = process.env[`${prefix}_PASSWORD`] || defaults.password;

  // `update` vacío: si la cuenta ya existe no se cambia su contraseña ni su rol.
  await prisma.user.upsert({
    where: { email },
    update: {},
    create: { name, email, passwordHash: await passwords.hash(password), role },
  });
  logger.info(`Cuenta ${role.toLowerCase()} lista: ${email}`);
}

try {
  await seedCatalog();
  await seedAccount('ADMIN', 'SEED_ADMIN');
  await seedAccount('USER', 'SEED_USER');
} catch (error) {
  logger.error('No se pudo cargar la semilla.', error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
