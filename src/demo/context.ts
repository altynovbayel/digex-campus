/** ТОЛЬКО ДЛЯ ДЕМОНСТРАЦИИ. */
import { createContext } from 'react';
import type { DemoScenario, DemoStatus } from './scenarios';

export interface DemoSessionValue extends DemoScenario {
  demoStatus: DemoStatus;
  setDemoStatus: (status: DemoStatus) => void;
}

export const DemoSessionContext = createContext<DemoSessionValue | null>(null);
