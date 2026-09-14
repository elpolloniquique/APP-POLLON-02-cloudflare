import { createContext, useContext } from 'react';

export const PollonBotContext = createContext(null);

export function usePollonBot() {
  const ctx = useContext(PollonBotContext);
  if (!ctx) throw new Error('usePollonBot debe usarse dentro del layout');
  return ctx;
}
