import { beforeEach, describe, expect, it } from 'vitest';
import { CatalogUseCase } from '../../src/application/use-cases/catalog.use-case.js';
import type { FileToUpload } from '../../src/domain/services/IFileStorage.js';
import { createInMemoryInfrastructure } from '../support/in-memory.js';

const ADMIN = { id: 'cadmin', role: 'admin' } as const;
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

function png(overrides: Partial<FileToUpload> = {}): FileToUpload {
  return { content: PNG, mimeType: 'image/png', size: PNG.length, originalName: 'foto.png', ...overrides };
}

const baseItem = {
  category: 'importaciones',
  direction: 'EGRESOS',
  code: '2010',
  title: 'Pago de importaciones',
  description: 'Descripción',
} as const;

describe('CatalogUseCase', () => {
  let infra: ReturnType<typeof createInMemoryInfrastructure>;
  let catalog: CatalogUseCase;

  beforeEach(() => {
    infra = createInMemoryInfrastructure();
    catalog = new CatalogUseCase(infra.catalog, infra.files);
  });

  it('crea un numeral sin imagen con note e imageUrl nulos', async () => {
    const item = await catalog.create(baseItem);

    expect(item).toMatchObject({ ...baseItem, note: null, imageUrl: null, state: 'ACTIVE' });
  });

  it('rechaza un duplicado (categoría, dirección, código) con 409', async () => {
    await catalog.create(baseItem);

    await expect(catalog.create(baseItem)).rejects.toMatchObject({ status: 409 });
  });

  it('sube la imagen al crear y guarda la URL', async () => {
    const item = await catalog.create(baseItem, png());

    expect(item.imageUrl).toMatch(/^https:\/\/storage\.test\/catalogo\//);
    expect(infra.files.files.size).toBe(1);
  });

  it('responde 503 si el almacenamiento no está configurado y no crea el numeral', async () => {
    infra.files.configured = false;

    await expect(catalog.create(baseItem, png())).rejects.toMatchObject({
      status: 503,
      code: 'IMAGE_STORAGE_NOT_CONFIGURED',
    });
    expect(infra.catalog.items).toHaveLength(0);
  });

  it('responde 502 si el almacenamiento falla', async () => {
    infra.files.failing = true;

    await expect(catalog.create(baseItem, png())).rejects.toMatchObject({ status: 502, code: 'IMAGE_UPLOAD_FAILED' });
  });

  it.each([
    ['tipo no permitido', png({ mimeType: 'image/gif' }), 415],
    ['más de 5 MB', png({ size: 5 * 1024 * 1024 + 1 }), 413],
    ['firma de bytes falsa', png({ content: Buffer.from('<?php echo 1; ?>') }), 400],
  ])('rechaza una imagen con %s', async (_case, image, status) => {
    await expect(catalog.create(baseItem, image)).rejects.toMatchObject({ status });
    expect(infra.files.files.size).toBe(0);
  });

  it('reemplaza la imagen y borra la anterior del bucket', async () => {
    const created = await catalog.create(baseItem, png());
    const updated = await catalog.update(created.id, {}, png());

    expect(updated.imageUrl).not.toBe(created.imageUrl);
    expect(infra.files.files.size).toBe(1);
    expect(infra.files.files.has(created.imageUrl ?? '')).toBe(false);
  });

  it('exige al menos un cambio al actualizar', async () => {
    const created = await catalog.create(baseItem);

    await expect(catalog.update(created.id, {})).rejects.toMatchObject({ status: 400 });
  });

  it('rechaza actualizar hacia una clave ya usada', async () => {
    await catalog.create(baseItem);
    const other = await catalog.create({ ...baseItem, code: '2011' });

    await expect(catalog.update(other.id, { code: '2010' })).rejects.toMatchObject({ status: 409 });
  });

  it('el borrado es lógico y borrar dos veces responde 404', async () => {
    const created = await catalog.create(baseItem);

    await catalog.remove(created.id);

    expect(infra.catalog.items[0]).toMatchObject({ state: 'REMOVED' });
    await expect(catalog.remove(created.id)).rejects.toMatchObject({ status: 404 });
  });

  it('el público solo ve activos; el administrador puede ver removidos con state', async () => {
    const removed = await catalog.create(baseItem);
    await catalog.create({ ...baseItem, code: '2011' });
    await catalog.remove(removed.id);

    const publicList = await catalog.list({ page: 1, limit: 10, state: 'REMOVED' });
    const adminRemoved = await catalog.list({ page: 1, limit: 10, state: 'REMOVED' }, ADMIN);
    const adminAll = await catalog.list({ page: 1, limit: 10, state: 'ALL' }, ADMIN);
    const adminDefault = await catalog.list({ page: 1, limit: 10 }, ADMIN);

    expect(publicList.data.map((item) => item.code)).toEqual(['2011']);
    expect(adminRemoved.data.map((item) => item.code)).toEqual(['2010']);
    expect(adminAll.pagination.total).toBe(2);
    expect(adminDefault.pagination.total).toBe(1);
  });

  it('un numeral removido es 404 para el público y visible para el administrador', async () => {
    const created = await catalog.create(baseItem);
    await catalog.remove(created.id);

    await expect(catalog.getById(created.id)).rejects.toMatchObject({ status: 404 });
    await expect(catalog.getById(created.id, ADMIN)).resolves.toMatchObject({ state: 'REMOVED' });
  });

  it('un administrador restaura un numeral con state ACTIVE', async () => {
    const created = await catalog.create(baseItem);
    await catalog.remove(created.id);

    const restored = await catalog.update(created.id, { state: 'ACTIVE' });

    expect(restored.state).toBe('ACTIVE');
  });

  it('calcula la paginación sin campos redundantes', async () => {
    for (const code of ['1', '2', '3']) await catalog.create({ ...baseItem, code });

    const result = await catalog.list({ page: 2, limit: 2 });

    expect(result.pagination).toEqual({ total: 3, currentPage: 2, limit: 2, totalPages: 2 });
    expect(result.data).toHaveLength(1);
  });

  it('filtra por búsqueda y categoría', async () => {
    await catalog.create(baseItem);
    await catalog.create({ ...baseItem, category: 'exportaciones', code: '1010', title: 'Café' });

    const byCategory = await catalog.list({ page: 1, limit: 10, category: 'exportaciones' });
    const bySearch = await catalog.list({ page: 1, limit: 10, search: 'pago' });

    expect(byCategory.data.map((item) => item.code)).toEqual(['1010']);
    expect(bySearch.data.map((item) => item.code)).toEqual(['2010']);
  });
});
