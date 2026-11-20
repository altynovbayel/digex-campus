import { useContext } from 'react';
import { CabinetContext, type CabinetValue } from './context';

export function useCabinet(): CabinetValue {
  const ctx = useContext(CabinetContext);
  if (!ctx) throw new Error('useCabinet должен использоваться внутри провайдера кабинета');
  return ctx;
}
