import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Configuration for the Prisma CLI (generate, migrate, studio). The running
 * API does not read this file: it connects through the driver adapter in
 * src/lib/database/prisma-client.ts.
 *
 * Migrations use DIRECT_URL when it is set (a direct connection, for when
 * DATABASE_URL points at a pooler) and DATABASE_URL otherwise. Neither is
 * needed to generate the client, which is why they are read here and not with
 * Prisma's `env()` helper: that helper throws when the variable is missing,
 * and the image build generates the client with no database in sight.
 */
const migrationUrl = process.env['DIRECT_URL'] || process.env['DATABASE_URL'];

export default defineConfig({
  // A folder: the schema is one file per model under prisma/models.
  schema: 'prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  ...(migrationUrl ? { datasource: { url: migrationUrl } } : {}),
});
