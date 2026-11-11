import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PrismaClient, type Prisma } from '@prisma/client';
import { logger } from '../src/infrastructure/logger.js';

type CatalogEntry = [code: string, title: string, description: string, note?: string];
type CatalogGroup = Record<string, CatalogEntry[]>;
type CatalogFile = Record<string, CatalogGroup>;

const prisma = new PrismaClient();

function assertProductionTarget(): void {
  if (process.env.CATALOG_SEED_TARGET !== 'production') {
    throw new Error('Define CATALOG_SEED_TARGET=production only after confirming the Render database URL.');
  }

  const databaseUrl = process.env.DATABASE_URL;
  const directUrl = process.env.DIRECT_URL;
  if (!databaseUrl || !directUrl) {
    throw new Error('DATABASE_URL and DIRECT_URL must both point to the Render production database.');
  }

  const databaseUrls: Array<[string, string]> = [
    ['DATABASE_URL', databaseUrl],
    ['DIRECT_URL', directUrl],
  ];
  for (const [name, value] of databaseUrls) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new Error(`${name} must be a valid PostgreSQL URL.`);
    }

    if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
      throw new Error(`${name} must be a PostgreSQL URL.`);
    }
    if (['localhost', '127.0.0.1', '::1'].includes(url.hostname.toLowerCase())) {
      throw new Error('The production catalog loader refuses to run against a local database.');
    }
  }
}

async function readJson<T>(relativePath: string): Promise<T> {
  return JSON.parse(await readFile(resolve(process.cwd(), relativePath), 'utf8')) as T;
}

async function seedCatalog(): Promise<void> {
  assertProductionTarget();

  const catalog = await readJson<CatalogFile>('prisma/data/catalogo.json');
  catalog.servicios = await readJson<CatalogGroup>('prisma/data/servicios.json');

  const rows: Prisma.CatalogItemCreateManyInput[] = [];
  for (const [category, directions] of Object.entries(catalog)) {
    for (const [direction, entries] of Object.entries(directions)) {
      if (direction !== 'ingresos' && direction !== 'egresos') {
        throw new Error(`Unknown catalog direction: ${direction}`);
      }

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

  if (rows.length === 0) throw new Error('No catalog entries were found.');

  const { count } = await prisma.catalogItem.createMany({ data: rows, skipDuplicates: true });
  logger.info(`Catalog only: inserted ${count} new numerals from ${rows.length} entries.`);
}

try {
  await seedCatalog();
} catch (error) {
  logger.error('Catalog-only seed failed.', error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
