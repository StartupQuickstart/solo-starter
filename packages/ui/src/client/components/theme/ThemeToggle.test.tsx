import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useTheme = vi.hoisted(() => vi.fn());

vi.mock('next-themes', () => ({ useTheme }));

import { ThemeToggle } from './ThemeToggle';

const setTheme = vi.fn<(theme: string) => void>();

describe('ThemeToggle', () => {
  beforeEach(() => {
    useTheme.mockReset();
    setTheme.mockReset();
  });

  it('offers dark while light is showing', async () => {
    useTheme.mockReturnValue({ theme: 'light', resolvedTheme: 'light', forcedTheme: undefined, setTheme });
    render(<ThemeToggle />);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Switch to dark theme' }));

    expect(setTheme).toHaveBeenCalledWith('dark');
  });

  it('offers light to a visitor whose system preference is dark and who has chosen nothing', async () => {
    // The stored choice is "system"; what is showing is dark.
    useTheme.mockReturnValue({ theme: 'system', resolvedTheme: 'dark', forcedTheme: undefined, setTheme });
    render(<ThemeToggle />);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Switch to light theme' }));

    expect(setTheme).toHaveBeenCalledWith('light');
  });

  it('is not shown when the app forces one theme, since it could switch nothing', () => {
    useTheme.mockReturnValue({ theme: 'system', resolvedTheme: 'dark', forcedTheme: 'light', setTheme });
    render(<ThemeToggle />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
