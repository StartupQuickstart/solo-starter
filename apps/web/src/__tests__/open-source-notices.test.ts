import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { NOTICES_FILE, renderFromDisk } from '../../scripts/generate-notices.mjs';

/**
 * The open source notices a deployed app serves at /open-source-notices.txt.
 * The document in docs/ is the source; the copy in public/ is what ships,
 * because the docs folder is not part of an image.
 */
describe('the open source notices the app serves', () => {
  const served = readFileSync(NOTICES_FILE, 'utf8');

  it('are the document in docs/, word for word', () => {
    // If this fails, docs/THIRD-PARTY-NOTICES.md changed: run `pnpm --filter @app/web notices:generate`.
    expect(served).toBe(renderFromDisk());
  });

  it('carry the attribution the two typefaces ask for', () => {
    expect(served).toContain('Bricolage Grotesque');
    expect(served).toContain('Geist');
    expect(served).toContain('SIL Open Font License');
  });
});
