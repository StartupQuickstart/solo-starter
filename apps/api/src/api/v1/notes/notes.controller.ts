import { getAuthenticatedUser } from '@app/backend';
import type { Request, Response } from 'express';

import { buildPagination, sendData, sendError } from '@/api/envelope';

import { NOTE_MESSAGE, NOTES_EXPORT } from './notes.constants';
import { notesCsvHeader, notesCsvRows } from './notes.csv';
import type { NoteRecord, NotesModel } from './notes.model';
import { createNoteSchema, listNotesQuerySchema, noteParamsSchema, updateNoteSchema } from './notes.schemas';

/** A note as the API serves it. Dates are ISO strings. */
interface NoteResponse extends Omit<NoteRecord, 'createdAt' | 'updatedAt'> {
  readonly createdAt: string;
  readonly updatedAt: string;
}

function toResponse(note: NoteRecord): NoteResponse {
  return { ...note, createdAt: note.createdAt.toISOString(), updatedAt: note.updatedAt.toISOString() };
}

const HTTP_NOT_FOUND = 404;
const HTTP_CREATED = 201;

/**
 * Notes. HTTP only: parse the input, call the model, shape the response.
 *
 * Every handler starts with `getAuthenticatedUser(req)` and passes the user's
 * id to the model, which filters by it. A note that belongs to someone else
 * answers 404, the same as one that does not exist, so nobody can learn
 * which ids are taken.
 */
export class NotesController {
  constructor(
    private readonly model: NotesModel,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** GET /notes */
  async list(req: Request, res: Response): Promise<void> {
    const { userId } = getAuthenticatedUser(req);
    const { page, limit } = listNotesQuerySchema.parse(req.query);

    const { rows, total } = await this.model.list(userId, { page, limit });
    sendData(res, rows.map(toResponse), { pagination: buildPagination(page, limit, total) });
  }

  /** GET /notes/:noteId */
  async get(req: Request, res: Response): Promise<void> {
    const { userId } = getAuthenticatedUser(req);
    const { noteId } = noteParamsSchema.parse(req.params);

    const note = await this.model.findById(userId, noteId);
    if (!note) {
      sendError(res, HTTP_NOT_FOUND, NOTE_MESSAGE.notFound);
      return;
    }
    sendData(res, toResponse(note));
  }

  /** POST /notes */
  async create(req: Request, res: Response): Promise<void> {
    const { userId } = getAuthenticatedUser(req);
    const data = createNoteSchema.parse(req.body);

    const note = await this.model.create(userId, data, this.now());
    sendData(res, toResponse(note), { status: HTTP_CREATED });
  }

  /** PATCH /notes/:noteId */
  async update(req: Request, res: Response): Promise<void> {
    const { userId } = getAuthenticatedUser(req);
    const { noteId } = noteParamsSchema.parse(req.params);
    const data = updateNoteSchema.parse(req.body);

    const note = await this.model.update(userId, noteId, data, this.now());
    if (!note) {
      sendError(res, HTTP_NOT_FOUND, NOTE_MESSAGE.notFound);
      return;
    }
    sendData(res, toResponse(note));
  }

  /** DELETE /notes/:noteId */
  async remove(req: Request, res: Response): Promise<void> {
    const { userId } = getAuthenticatedUser(req);
    const { noteId } = noteParamsSchema.parse(req.params);

    const removed = await this.model.remove(userId, noteId, this.now());
    if (!removed) {
      sendError(res, HTTP_NOT_FOUND, NOTE_MESSAGE.notFound);
      return;
    }
    sendData(res, { deleted: true });
  }

  /**
   * GET /notes/export (subscribers; the route adds `requireSubscription`)
   *
   * Every note of the user as a CSV download, written a batch at a time.
   */
  async exportCsv(req: Request, res: Response): Promise<void> {
    const { userId } = getAuthenticatedUser(req);
    const batches = this.model.exportBatches(userId);

    // Read the first batch before sending anything, so a database failure is
    // still answered as an ordinary error and not as half a file.
    let batch = await batches.next();

    res.setHeader('Content-Type', NOTES_EXPORT.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${NOTES_EXPORT.filename}"`);
    res.write(notesCsvHeader());
    while (!batch.done) {
      res.write(notesCsvRows(batch.value));
      batch = await batches.next();
    }
    res.end();
  }
}
