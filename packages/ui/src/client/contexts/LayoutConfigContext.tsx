'use client';

import { createContext, useContext, type ReactNode } from 'react';

import type { LogoConfig } from '../components/layout/Logo';

export interface LayoutConfig {
  /** Logo configuration */
  logo?: LogoConfig;
  /** Show the light/dark toggle in the header. Defaults to true; set false for a light-only app. */
  themeToggle?: boolean;
}

const LayoutConfigContext = createContext<LayoutConfig | undefined>(undefined);

interface LayoutConfigProviderProps {
  children: ReactNode;
  config?: LayoutConfig;
}

export function LayoutConfigProvider({ children, config }: LayoutConfigProviderProps) {
  return <LayoutConfigContext.Provider value={config}>{children}</LayoutConfigContext.Provider>;
}

export function useLayoutConfig(): LayoutConfig | undefined {
  return useContext(LayoutConfigContext);
}
