import { useContext } from 'react';
import { DemoSessionContext, type DemoSessionValue } from './context';

/** ТОЛЬКО ДЛЯ ДЕМОНСТРАЦИИ: текущий демо-ученик и его данные. */
export function useDemoSession(): DemoSessionValue {
  const ctx = useContext(DemoSessionContext);
  if (!ctx) throw new Error('useDemoSession должен использоваться внутри DemoSessionProvider');
  return ctx;
}
