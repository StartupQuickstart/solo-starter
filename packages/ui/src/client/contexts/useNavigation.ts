import { createContext, useContext } from 'react';

import type { NavigationConfig } from './NavigationProvider';

export interface BreadcrumbData {
  /** Unique identifier for the breadcrumb item */
  id: string;
  /** Display text for the breadcrumb */
  label: string;
  /** URL to navigate to (optional for current page) */
  href?: string;
  /** Whether this item is the current page */
  isCurrentPage?: boolean;
}

interface NavigationContextType {
  /** The navigation tree with the current page's item marked active. */
  navigation: NavigationConfig;
  /** Breadcrumbs set by the current page; empty after a navigation until the new page sets its own. */
  breadcrumbs: BreadcrumbData[];
  setBreadcrumbs: (breadcrumbs: BreadcrumbData[]) => void;
  clearBreadcrumbs: () => void;
}

export const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}

export function useBreadcrumbs() {
  const { breadcrumbs, setBreadcrumbs, clearBreadcrumbs } = useNavigation();
  return {
    breadcrumbs,
    setBreadcrumbs,
    clearBreadcrumbs,
  };
}
