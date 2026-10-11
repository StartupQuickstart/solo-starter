import type { Prisma, PrismaClient } from '../../../../generated/prisma';

import { NOTE_LIMITS } from './notes.constants';

/**
 * Notes: persistence only.
 *
 * Every method takes `userId` and puts it in the `where` clause, together
 * with `deletedAt: null`. A note that belongs to someone else is therefore
 * simply not found: there is no "fetch, then check the owner" step to forget.
 * Copy this shape for your own tables.
 */

const NOTE_SELECT = { id: true, title: true, body: true, createdAt: true, updatedAt: true } as const;

export type NoteRecord = Prisma.NoteGetPayload<{ select: typeof NOTE_SELECT }>;

export interface NoteListOptions {
  readonly page: number;
  readonly limit: number;
}

export interface NoteWriteData {
  readonly title?: string | undefined;
  readonly body?: string | undefined;
}

/** Newest first; the id breaks a tie between notes created in the same millisecond. */
const NEWEST_FIRST: Prisma.NoteOrderByWithRelationInput[] = [{ createdAt: 'desc' }, { id: 'desc' }];

export class NotesModel {
  /** @param prisma - The application Prisma client */
  constructor(private readonly prisma: PrismaClient) {}

  /** The owner filter. Used by every query in this class. */
  private ownedBy(userId: string): Prisma.NoteWhereInput {
    return { userId, deletedAt: null };
  }

  async list(userId: string, options: NoteListOptions): Promise<{ rows: NoteRecord[]; total: number }> {
    const where = this.ownedBy(userId);
    const [rows, total] = await Promise.all([
      this.prisma.note.findMany({
        where,
        select: NOTE_SELECT,
        orderBy: NEWEST_FIRST,
        skip: (options.page - 1) * options.limit,
        take: options.limit,
      }),
      this.prisma.note.count({ where }),
    ]);
    return { rows, total };
  }

  async findById(userId: string, noteId: string): Promise<NoteRecord | null> {
    return this.prisma.note.findFirst({ where: { ...this.ownedBy(userId), id: noteId }, select: NOTE_SELECT });
  }

  /**
   * @param userId - The owner
   * @param data - The note's fields
   * @param now - The clock's reading; one clock for both times on the row
   */
  async create(userId: string, data: { readonly title: string; readonly body: string }, now: Date): Promise<NoteRecord> {
    return this.prisma.note.create({
      data: { userId, title: data.title, body: data.body, createdAt: now, updatedAt: now },
      select: NOTE_SELECT,
    });
  }

  /**
   * Changes the fields present in `data`.
   *
   * @returns The note after the change; `null` when it is not this user's
   */
  async update(userId: string, noteId: string, data: NoteWriteData, now: Date): Promise<NoteRecord | null> {
    // updateMany carries the owner filter into the write itself.
    const [updated] = await this.prisma.note.updateManyAndReturn({
      where: { ...this.ownedBy(userId), id: noteId },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.body !== undefined ? { body: data.body } : {}),
        updatedAt: now,
      },
      select: NOTE_SELECT,
    });
    return updated ?? null;
  }

  /**
   * Soft-deletes a note.
   *
   * @returns `false` when the note is not this user's
   */
  async remove(userId: string, noteId: string, now: Date): Promise<boolean> {
    const { count } = await this.prisma.note.updateMany({
      where: { ...this.ownedBy(userId), id: noteId },
      data: { deletedAt: now },
    });
    return count > 0;
  }

  /**
   * Every note of the user, newest first, a batch at a time, so an export of
   * any size holds one batch in memory. Each batch starts after the last note
   * of the one before it (keyset paging), which stays correct while notes are
   * added or deleted during the export.
   */
  async *exportBatches(userId: string): AsyncGenerator<NoteRecord[]> {
    let after: NoteRecord | undefined;
    for (;;) {
      const batch: NoteRecord[] = await this.prisma.note.findMany({
        where: {
          ...this.ownedBy(userId),
          ...(after
            ? { OR: [{ createdAt: { lt: after.createdAt } }, { createdAt: after.createdAt, id: { lt: after.id } }] }
            : {}),
        },
        select: NOTE_SELECT,
        orderBy: NEWEST_FIRST,
        take: NOTE_LIMITS.exportBatchSize,
      });
      if (batch.length === 0) return;
      yield batch;
      if (batch.length < NOTE_LIMITS.exportBatchSize) return;
      after = batch[batch.length - 1];
    }
  }
}
