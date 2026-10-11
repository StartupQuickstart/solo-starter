# Third-party notices

The starter's own licence is in [LICENSE](../LICENSE). An application built
from it also contains open source components under their own licences. This
document lists the two typefaces, which end up in what a browser downloads and
ask for attribution there.

It is not an audit of every dependency: the other packages in `pnpm-lock.yaml`
(React, Next.js, Tailwind CSS and the rest) have licences of their own, and
you are responsible for meeting them in what you distribute.

A deployed app serves this document at `/open-source-notices.txt`, linked from
the foot of the Account page, so the attributions travel with the build. That
file is a generated copy (`apps/web/public/open-source-notices.txt`): after
editing this document, run `pnpm --filter @app/web notices:generate`. A unit
test fails if you forget.

Each licence below was read from the installed package, at the version in the
lockfile. The paths are relative to the repository root, after `pnpm install`.

| Component | Version | Licence | Licence text |
|---|---|---|---|
| Bricolage Grotesque (`@fontsource-variable/bricolage-grotesque`) | 5.3.0 | SIL Open Font License 1.1 | `apps/web/node_modules/@fontsource-variable/bricolage-grotesque/LICENSE` |
| Geist (`@fontsource-variable/geist`) | 5.3.0 | SIL Open Font License 1.1 | `apps/web/node_modules/@fontsource-variable/geist/LICENSE` |

## The typefaces

Both are licensed under the SIL Open Font License, Version 1.1, and are
served from the app (the font files are copied into the build from the two
`@fontsource-variable` packages).

- Bricolage Grotesque: `Copyright 2022 The Bricolage Grotesque Project Authors
  (https://github.com/ateliertriay/bricolage)`
- Geist: `Copyright 2024 The Geist Project Authors
  (https://github.com/vercel/geist-font)`

The licence lets the fonts be used, embedded and redistributed with any
software, provided each copy carries the copyright notice and the licence;
the fonts may not be sold by themselves; and a modified version must stay
under the same licence. Keep the two licence files with your notices. If you
change the typefaces (the two imports in `apps/web/src/app/layout.tsx` and
the two font-family tokens in `apps/web/src/app/globals.css`), replace these
entries with the licences of the faces you choose.
