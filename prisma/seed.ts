import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import bcrypt from 'bcryptjs';
import { CatalogDirection, PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

type CatalogGroup = Record<string, Array<[string, string, string, string?]>>;
type CatalogData = Record<string, CatalogGroup>;

async function loadCatalog(): Promise<CatalogData> {
  const sourcePath = resolve(process.cwd(), 'prisma/data/catalogo.json');
  const source = await readFile(sourcePath, 'utf8');
  return JSON.parse(source) as CatalogData;
}

async function seedCatalog() {
  const catalog = await loadCatalog();
  let count = 0;
  for (const [category, directions] of Object.entries(catalog)) {
    for (const [direction, entries] of Object.entries(directions)) {
      for (const [code, title, description, note] of entries) {
        await prisma.catalogItem.upsert({
          where: {
            category_direction_code: {
              category,
              direction: direction.toUpperCase() as CatalogDirection,
              code,
            },
          },
          update: { title, description, note: note ?? null, active: true },
          create: {
            category,
            direction: direction.toUpperCase() as CatalogDirection,
            code,
            title,
            description,
            note: note ?? null,
          },
        });
        count += 1;
      }
    }
  }
  console.log(`Catálogo cargado o actualizado: ${count} numerales.`);
}

async function seedTestUser(role: UserRole, nameEnv: string, emailEnv: string, passwordEnv: string) {
  const email = process.env[emailEnv]?.trim().toLowerCase();
  const password = process.env[passwordEnv];
  if (!email && !password) return;
  if (!email || !password || password.length < 12) {
    throw new Error(`${emailEnv} y ${passwordEnv} deben configurarse juntos; la contraseña requiere 12 caracteres.`);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { email },
    update: { name: process.env[nameEnv]?.trim() || role, passwordHash, role },
    create: { name: process.env[nameEnv]?.trim() || role, email, passwordHash, role },
  });
  console.log(`Cuenta ${role.toLowerCase()} de prueba preparada: ${email}`);
}

try {
  await seedCatalog();
  await seedTestUser(UserRole.ADMIN, 'SEED_ADMIN_NAME', 'SEED_ADMIN_EMAIL', 'SEED_ADMIN_PASSWORD');
  await seedTestUser(UserRole.USER, 'SEED_USER_NAME', 'SEED_USER_EMAIL', 'SEED_USER_PASSWORD');
} finally {
  await prisma.$disconnect();
}
