'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

interface HeaderActionsContextValue {
  actions: ReactNode | undefined;
  setActions: (actions: ReactNode | undefined) => void;
}

const HeaderActionsContext = createContext<HeaderActionsContextValue | undefined>(undefined);

interface HeaderActionsProviderProps {
  children: ReactNode;
}

export function HeaderActionsProvider({ children }: HeaderActionsProviderProps) {
  const [actions, setActionsState] = useState<ReactNode | undefined>(undefined);

  const setActions = useCallback((newActions: ReactNode | undefined) => {
    setActionsState(newActions);
  }, []);

  return (
    <HeaderActionsContext.Provider value={{ actions, setActions }}>
      {children}
    </HeaderActionsContext.Provider>
  );
}

export function useHeaderActions(): ReactNode | undefined {
  const context = useContext(HeaderActionsContext);
  return context?.actions;
}

export function useSetHeaderActions(): (actions: ReactNode | undefined) => void {
  const context = useContext(HeaderActionsContext);
  if (!context) {
    return () => {}; // No-op if not in provider
  }
  return context.setActions;
}
