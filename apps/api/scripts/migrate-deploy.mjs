#!/usr/bin/env node
/**
 * `prisma migrate deploy`, retried while Postgres is still waking up.
 *
 * A host may put an idle Postgres to sleep. A deploy's pre-deploy step wakes
 * it, and the first connection can land before it accepts queries ("the
 * database system is starting up"). `migrate deploy` is safe to retry: it takes an advisory lock and
 * applies only pending migrations. Any other failure (a broken migration)
 * fails immediately.
 */
import { spawnSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const MAX_ATTEMPTS = 6;
const RETRY_DELAY_MS = 5_000;

/** Errors that mean "database not ready yet", never "migration is wrong". */
const TRANSIENT_ERRORS = [
  'the database system is starting up',
  "Can't reach database server", // Prisma P1001
  'P1001',
  'Connection refused',
];

function migrate() {
  return spawnSync('prisma', ['migrate', 'deploy', '--schema', 'prisma/'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
}

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
  const result = migrate();
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');

  if (result.status === 0) process.exit(0);

  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  const transient = TRANSIENT_ERRORS.some((marker) => output.includes(marker));
  if (!transient || attempt === MAX_ATTEMPTS) process.exit(result.status ?? 1);

  console.warn(
    `migrate-deploy: database not ready (attempt ${attempt}/${MAX_ATTEMPTS}); retrying in ${RETRY_DELAY_MS / 1000}s`,
  );
  await sleep(RETRY_DELAY_MS);
}
