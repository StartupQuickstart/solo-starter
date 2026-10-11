'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';

import { Button } from '@/client/components/ui/button';

const THEME = { light: 'light', dark: 'dark' } as const;

function subscribeToNothing(): () => void {
  return () => {};
}

/**
 * False while rendering on the server and during hydration, true afterwards.
 * The stored theme is only known in the browser, so until then the toggle
 * renders the same neutral icon the server did.
 */
function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
}

/**
 * Switches between the light and dark themes.
 *
 * It reads the theme that is showing (`resolvedTheme`), not the stored choice
 * (`theme`), which is `system` until the visitor picks one: a visitor whose
 * system is dark would otherwise be offered dark again. An app that forces one
 * theme gets no toggle, because there is nothing it could switch.
 */
export function ThemeToggle() {
  const { resolvedTheme, forcedTheme, setTheme } = useTheme();
  const hydrated = useHydrated();

  if (forcedTheme) return null;

  if (!hydrated) {
    return (
      <Button variant="ghost" size="icon-sm" className="text-muted-foreground">
        <Sun className="size-4" />
        <span className="sr-only">Toggle theme</span>
      </Button>
    );
  }

  const isDark = resolvedTheme === THEME.dark;

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={() => setTheme(isDark ? THEME.light : THEME.dark)}
      className="text-muted-foreground hover:text-foreground"
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
      <span className="sr-only">{isDark ? 'Switch to light theme' : 'Switch to dark theme'}</span>
    </Button>
  );
}
