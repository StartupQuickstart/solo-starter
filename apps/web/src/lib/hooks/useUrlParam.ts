'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';

/**
 * One query-string parameter as state: read it from the URL, and write it
 * back without adding a history entry or scrolling. `null` removes it, so a
 * default value never clutters the address.
 *
 * Keeping view state here (a tab, a filter, a page number) means a reload, a
 * bookmark and a shared link all show what the person was looking at.
 *
 * @param name - The parameter's name.
 * @returns The current value (or `null`) and a setter that also accepts several parameters at once.
 */
export function useUrlParams(): readonly [URLSearchParams, (changes: Readonly<Record<string, string | null>>) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // The query string as last asked for. A write is a navigation, which takes a moment to show up in
  // `searchParams`; a second write in that moment (a filter picked while a search is settling) must
  // build on the first, not on the address from before it, or it would undo it.
  const current = searchParams.toString();
  const latest = useRef(current);
  useEffect(() => {
    latest.current = current;
  }, [current]);

  const setParams = useCallback(
    (changes: Readonly<Record<string, string | null>>) => {
      const next = new URLSearchParams(latest.current);
      for (const [name, value] of Object.entries(changes)) {
        if (value === null || value === '') next.delete(name);
        else next.set(name, value);
      }
      const query = next.toString();
      latest.current = query;
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  return [searchParams, setParams];
}
