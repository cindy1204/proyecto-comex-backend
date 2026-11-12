import type { PrismaClient } from '@prisma/client';
import type {
  IStoredFileRepository,
  NewStoredFile,
  StoredFile,
} from '../../domain/repository/IStoredFile.repository.js';

export class StoredFilePrismaRepository implements IStoredFileRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(file: NewStoredFile): Promise<string> {
    const row = await this.prisma.storedFile.create({
      data: { mimeType: file.mimeType, content: Buffer.from(file.content) },
      select: { id: true },
    });
    return row.id;
  }

  async findById(id: string): Promise<StoredFile | null> {
    const row = await this.prisma.storedFile.findUnique({ where: { id } });
    return row ? { id: row.id, mimeType: row.mimeType, content: row.content } : null;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.storedFile.deleteMany({ where: { id } });
  }
}
