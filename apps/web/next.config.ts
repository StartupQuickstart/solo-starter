import type { NextConfig } from 'next';

// KIT CARD: remove this import.
import { KIT_CARD_FLAG, KIT_CARD_VARIABLE, UPGRADE_ROUTES } from './src/features/kit-upgrade/kit-flag';

/**
 * KIT CARD: remove this block, down to NOWHERE.
 * A build with the application kit card switched off
 * (NEXT_PUBLIC_SHOW_KIT_CARD=0) must answer 404 for /upgrade. The page itself
 * cannot: by the time it decides, the layout has started the response and the
 * status is already 200. So the address is sent, before any page is matched,
 * to one that does not exist, which the app answers with its not-found screen
 * and a real 404.
 */
const isKitCardOff = process.env[KIT_CARD_VARIABLE] === KIT_CARD_FLAG.off;
/** No page has this address, and none should be given it. */
const NOWHERE = '/_not-in-this-build';

// NOTE: context-bearing shared packages (@clerk/*, next-themes,
// @tanstack/react-query) must resolve to a SINGLE copy in the server bundle.
// Two copies mean two React contexts and Clerk hooks throw "must be used
// within <ClerkProvider>". This is enforced structurally, not here:
//  - this app and @app/ui depend on the same ranges of react and next, and
//    only this app depends on @clerk/nextjs, so pnpm resolves one version of
//    each (and with it one @clerk/shared; no override is needed)
//  - the Dockerfile appends node-linker=hoisted to .npmrc so the image
//    installs one physical copy
// If a duplicate-context error ever reappears, check `ls node_modules/.pnpm |
// grep @clerk+` for multiple versions (or one version with two peer suffixes)
// before reaching for aliases.
const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@app/ui'],
  // KIT CARD: remove `rewrites`. See isKitCardOff above.
  rewrites: async () => ({
    beforeFiles: isKitCardOff ? UPGRADE_ROUTES.map((source) => ({ source, destination: NOWHERE })) : [],
    afterFiles: [],
    fallback: [],
  }),
};

export default nextConfig;
