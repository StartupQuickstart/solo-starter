'use client';

import { useSyncExternalStore } from 'react';

/** Viewports narrower than this are treated as mobile (Tailwind's `md` breakpoint). */
export const MOBILE_BREAKPOINT = 768;

const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(MOBILE_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function isMobileNow(): boolean {
  return window.matchMedia(MOBILE_QUERY).matches;
}

/** The server cannot know the viewport; it renders the desktop layout. */
function isMobileOnServer(): boolean {
  return false;
}

/**
 * Whether the viewport is narrower than the mobile breakpoint. Follows the
 * media query, so it updates when the window is resized across it.
 */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, isMobileNow, isMobileOnServer);
}
