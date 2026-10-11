import { describe, expect, it } from 'vitest';

import { createNavigationConfig, isCurrentNavItem } from '@/config/navigation';

const items = (pathname: string) => createNavigationConfig(pathname).groups.flatMap((group) => group.items);

describe('isCurrentNavItem', () => {
  it('marks Home current only on Home itself', () => {
    expect(isCurrentNavItem('/', '/')).toBe(true);
    expect(isCurrentNavItem('/', '/billing')).toBe(false);
  });

  it('marks an item current on its page and on pages under it', () => {
    expect(isCurrentNavItem('/account', '/account')).toBe(true);
    expect(isCurrentNavItem('/account', '/account/security')).toBe(true);
  });

  it('does not match a different page that merely starts with the same letters', () => {
    expect(isCurrentNavItem('/account', '/accounting')).toBe(false);
  });
});

describe('createNavigationConfig', () => {
  it('lists exactly Home, Billing and Account', () => {
    expect(items('/').map((item) => [item.title, item.url])).toEqual([
      ['Home', '/'],
      ['Billing', '/billing'],
      ['Account', '/account'],
    ]);
  });

  it('marks exactly one item active for the current page', () => {
    const active = items('/account/security')
      .filter((item) => item.isActive)
      .map((item) => item.id);

    expect(active).toEqual(['account']);
  });
});
