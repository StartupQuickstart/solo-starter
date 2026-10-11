/**
 * The one setting that switches the application kit card and the /upgrade page
 * on or off, and the address of that page.
 *
 * This file imports nothing: `next.config.ts` reads it before the app is
 * built, and `src/config/app.config.ts` validates the variable with it.
 */

/** Unset, empty or `1`: shown. Exactly `0`: not in the build. Anything else fails the build. */
export const KIT_CARD_VARIABLE = 'NEXT_PUBLIC_SHOW_KIT_CARD';

/** The two values the variable may hold. */
export const KIT_CARD_FLAG = { off: '0', on: '1' } as const;

/** The in-app comparison page. */
export const UPGRADE_PATH = '/upgrade';

/** Every address the comparison page answers, as `next.config.ts` matches them. */
export const UPGRADE_ROUTES: readonly string[] = [UPGRADE_PATH, `${UPGRADE_PATH}/:path*`];
