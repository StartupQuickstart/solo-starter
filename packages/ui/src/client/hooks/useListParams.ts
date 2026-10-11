'use client';

import { useCallback, useEffect, useState } from 'react';

import type { SortState } from '@/client/components/data/SortableTableHead';

/** Default wait after the last keystroke before a search hits the server. */
export const SEARCH_DEBOUNCE_MS = 300;

/** `value`, updated only after it has stopped changing for `delayMs`. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export interface UseListParamsOptions<K extends string> {
  readonly defaultSort: SortState<K>;
  /** @default SEARCH_DEBOUNCE_MS */
  readonly debounceMs?: number;
}

export interface ListParams<K extends string> {
  /** What's in the search box right now (bind to the input). */
  readonly search: string;
  /** The settled search term to send to the server. */
  readonly debouncedSearch: string;
  readonly sort: SortState<K>;
  readonly page: number;
  readonly setSearch: (search: string) => void;
  readonly setSort: (sort: SortState<K>) => void;
  readonly setPage: (page: number) => void;
}

/**
 * Search, sort and page state for a server-backed table. Changing the search
 * or sort returns to page 1, so a narrowed result is never shown mid-list.
 * Filters owned by the page (tabs) should call `setPage(1)` too.
 */
export function useListParams<K extends string>({
  defaultSort,
  debounceMs = SEARCH_DEBOUNCE_MS,
}: UseListParamsOptions<K>): ListParams<K> {
  const [search, setSearchState] = useState('');
  const [sort, setSortState] = useState<SortState<K>>(defaultSort);
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search.trim(), debounceMs);

  const setSearch = useCallback((next: string) => {
    setSearchState(next);
    setPage(1);
  }, []);

  const setSort = useCallback((next: SortState<K>) => {
    setSortState(next);
    setPage(1);
  }, []);

  return { search, debouncedSearch, sort, page, setSearch, setSort, setPage };
}
