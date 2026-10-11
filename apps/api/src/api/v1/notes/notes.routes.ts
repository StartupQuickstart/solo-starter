import { Router } from 'express';

import type { PrismaClient } from '../../../../generated/prisma';
import { rateLimitByUser } from '@/api/middleware/rate-limit';
import { createRequireSubscription, createStoredSubscriptionReader } from '@/api/middleware/require-subscription';

import { NOTES_EXPORT_RATE_LIMIT } from './notes.constants';
import { NotesController } from './notes.controller';
import { NotesModel } from './notes.model';

/**
 * Notes: the example feature, and the pattern to copy for your own. Mounted at
 * `/api/v1/notes`, behind the session check. Every route works on the
 * signed-in user's own notes and nobody else's.
 *
 *   GET    /notes            list, newest first, in pages
 *   POST   /notes
 *   GET    /notes/export     subscribers only: every note as a CSV file
 *   GET    /notes/:noteId
 *   PATCH  /notes/:noteId
 *   DELETE /notes/:noteId    soft delete
 *
 * The export is the example of a paid feature: `requireSubscription` answers
 * 403 `SUBSCRIPTION_REQUIRED` unless the user is subscribed.
 *
 * @param prisma - The application Prisma client
 * @param now - The clock; tests fix it
 */
export function createNotesRouter(prisma: PrismaClient, now?: () => Date): Router {
  const controller = new NotesController(new NotesModel(prisma), now);
  const requireSubscription = createRequireSubscription(createStoredSubscriptionReader(prisma));
  const router = Router();

  router.get('/', (req, res) => controller.list(req, res));
  router.post('/', (req, res) => controller.create(req, res));
  // Before `/:noteId`, or "export" would be read as an id.
  router.get('/export', requireSubscription, rateLimitByUser(NOTES_EXPORT_RATE_LIMIT), (req, res) =>
    controller.exportCsv(req, res),
  );
  router.get('/:noteId', (req, res) => controller.get(req, res));
  router.patch('/:noteId', (req, res) => controller.update(req, res));
  router.delete('/:noteId', (req, res) => controller.remove(req, res));

  return router;
}
