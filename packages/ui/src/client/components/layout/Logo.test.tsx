import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useTheme = vi.hoisted(() => vi.fn());

vi.mock('next-themes', () => ({ useTheme }));

import { Logo } from './Logo';

const CONFIG = {
  src: '/brand/logo.svg',
  srcDark: '/brand/logo-on-dark.svg',
  alt: 'Sample logo',
  width: 132,
  height: 32,
} as const;

function logoSource(): string {
  return decodeURIComponent(screen.getByAltText(CONFIG.alt).getAttribute('src') ?? '');
}

describe('Logo', () => {
  beforeEach(() => {
    useTheme.mockReset();
  });

  it('uses the light logo when the app forces light, even if the visitor prefers dark', () => {
    // next-themes reports the system preference as resolvedTheme under a forced theme.
    useTheme.mockReturnValue({ resolvedTheme: 'dark', forcedTheme: 'light' });
    render(<Logo config={CONFIG} />);

    expect(logoSource()).toContain(CONFIG.src);
    expect(logoSource()).not.toContain(CONFIG.srcDark);
  });

  it('uses the dark logo when the app forces dark, even if the visitor prefers light', () => {
    useTheme.mockReturnValue({ resolvedTheme: 'light', forcedTheme: 'dark' });
    render(<Logo config={CONFIG} />);

    expect(logoSource()).toContain(CONFIG.srcDark);
  });

  it('uses the dark logo when the resolved theme is dark and nothing is forced', () => {
    useTheme.mockReturnValue({ resolvedTheme: 'dark', forcedTheme: undefined });
    render(<Logo config={CONFIG} />);

    expect(logoSource()).toContain(CONFIG.srcDark);
  });

  it('uses the light logo when the resolved theme is light', () => {
    useTheme.mockReturnValue({ resolvedTheme: 'light', forcedTheme: undefined });
    render(<Logo config={CONFIG} />);

    expect(logoSource()).toContain(CONFIG.src);
    expect(logoSource()).not.toContain(CONFIG.srcDark);
  });

  it('keeps the one logo it has in dark mode when no dark variant is configured', () => {
    useTheme.mockReturnValue({ resolvedTheme: 'dark', forcedTheme: undefined });
    render(<Logo config={{ src: CONFIG.src, alt: CONFIG.alt }} />);

    expect(logoSource()).toContain(CONFIG.src);
  });

  it('links to the home page by default and to nowhere when the link is turned off', () => {
    useTheme.mockReturnValue({ resolvedTheme: 'light', forcedTheme: undefined });
    const { unmount } = render(<Logo config={CONFIG} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/');
    unmount();

    render(<Logo config={CONFIG} href="" />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
