import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SEARCH_DEBOUNCE_MS, useDebouncedValue, useListParams } from './useListParams';

type Column = 'name' | 'createdAt';

const DEFAULT_SORT = { key: 'name', dir: 'asc' } as const;

function renderListParams() {
  return renderHook(() => useListParams<Column>({ defaultSort: DEFAULT_SORT }));
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useListParams', () => {
  it('starts on page 1 with an empty search and the default sort', () => {
    const { result } = renderListParams();

    expect(result.current).toMatchObject({ search: '', debouncedSearch: '', sort: DEFAULT_SORT, page: 1 });
  });

  it('updates the search box at once but the server term only after typing stops', () => {
    const { result } = renderListParams();

    act(() => result.current.setSearch('ada'));
    expect(result.current.search).toBe('ada');
    expect(result.current.debouncedSearch).toBe('');

    act(() => void vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS));
    expect(result.current.debouncedSearch).toBe('ada');
  });

  it('sends one term for a burst of keystrokes', () => {
    const { result } = renderListParams();

    act(() => result.current.setSearch('a'));
    act(() => void vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1));
    act(() => result.current.setSearch('ad'));
    act(() => void vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1));
    expect(result.current.debouncedSearch).toBe('');

    act(() => void vi.advanceTimersByTime(1));
    expect(result.current.debouncedSearch).toBe('ad');
  });

  it('trims the term sent to the server and leaves the box as typed', () => {
    const { result } = renderListParams();

    act(() => result.current.setSearch('  ada '));
    act(() => void vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS));

    expect(result.current.search).toBe('  ada ');
    expect(result.current.debouncedSearch).toBe('ada');
  });

  it('returns to page 1 when the search changes', () => {
    const { result } = renderListParams();
    act(() => result.current.setPage(4));

    act(() => result.current.setSearch('ada'));

    expect(result.current.page).toBe(1);
  });

  it('returns to page 1 when the sort changes', () => {
    const { result } = renderListParams();
    act(() => result.current.setPage(4));

    act(() => result.current.setSort({ key: 'createdAt', dir: 'desc' }));

    expect(result.current.sort).toEqual({ key: 'createdAt', dir: 'desc' });
    expect(result.current.page).toBe(1);
  });

  it('keeps the search and sort when only the page changes', () => {
    const { result } = renderListParams();
    act(() => result.current.setSearch('ada'));

    act(() => result.current.setPage(2));

    expect(result.current).toMatchObject({ search: 'ada', sort: DEFAULT_SORT, page: 2 });
  });
});

describe('useDebouncedValue', () => {
  it('honours a custom delay', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 1_000), {
      initialProps: { value: 'a' },
    });

    rerender({ value: 'b' });
    act(() => void vi.advanceTimersByTime(999));
    expect(result.current).toBe('a');

    act(() => void vi.advanceTimersByTime(1));
    expect(result.current).toBe('b');
  });
});
