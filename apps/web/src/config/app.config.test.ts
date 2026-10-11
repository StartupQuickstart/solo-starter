import { describe, expect, it } from 'vitest';

import { parseAppConfig, parseRuntimeEnv } from './app.config';

describe('parseAppConfig', () => {
  it('falls back to neutral placeholders when nothing is set', () => {
    const config = parseAppConfig({});

    expect(config.name).toBe('Your App');
    expect(config.supportEmail).toBe('support@example.com');
  });

  it('treats an empty variable the same as an unset one', () => {
    const config = parseAppConfig({ NEXT_PUBLIC_APP_NAME: '', NEXT_PUBLIC_SUPPORT_EMAIL: '' });

    expect(config.name).toBe('Your App');
    expect(config.supportEmail).toBe('support@example.com');
  });

  it('reads the product identity from the environment', () => {
    const config = parseAppConfig({
      NEXT_PUBLIC_APP_NAME: 'Northwind',
      NEXT_PUBLIC_SUPPORT_EMAIL: 'help@northwind.example',
    });

    expect(config.name).toBe('Northwind');
    expect(config.supportEmail).toBe('help@northwind.example');
  });

  it('names NEXT_PUBLIC_SUPPORT_EMAIL when its value is not an email address', () => {
    expect(() => parseAppConfig({ NEXT_PUBLIC_SUPPORT_EMAIL: 'not-an-email' })).toThrow(/NEXT_PUBLIC_SUPPORT_EMAIL/);
  });

  it('returns a frozen object', () => {
    expect(Object.isFrozen(parseAppConfig({}))).toBe(true);
  });
});

describe('parseRuntimeEnv', () => {
  it('points at the local API by default', () => {
    expect(parseRuntimeEnv({})).toEqual({ apiUrl: 'http://localhost:4000' });
  });

  it('rejects an API URL that is not a URL', () => {
    expect(() => parseRuntimeEnv({ NEXT_PUBLIC_API_URL: 'api.example.com' })).toThrow(/NEXT_PUBLIC_API_URL/);
  });
});
