// Copies docs/THIRD-PARTY-NOTICES.md into the web app's public folder, so the
// open source attributions travel with a deployed build (the docs folder is
// not part of a Docker image). The document in docs/ is the only place to
// edit; `pnpm --filter @app/web notices:generate` refreshes the copy, and a
// unit test fails when the two differ.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The document people edit. */
export const NOTICES_SOURCE = path.resolve(WEB_ROOT, '../../docs/THIRD-PARTY-NOTICES.md');
/** The copy the app serves, at /open-source-notices.txt. */
export const NOTICES_FILE = path.join(WEB_ROOT, 'public/open-source-notices.txt');

const HEADER = 'Generated from docs/THIRD-PARTY-NOTICES.md. Do not edit: run `pnpm --filter @app/web notices:generate`.\n\n';

/** What the served copy should contain, from the document as it is on disk. */
export function renderFromDisk() {
  return HEADER + readFileSync(NOTICES_SOURCE, 'utf8');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeFileSync(NOTICES_FILE, renderFromDisk());
  console.log(`wrote ${path.relative(WEB_ROOT, NOTICES_FILE)}`);
}
