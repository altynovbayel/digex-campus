/**
 * ТОЛЬКО ДЛЯ РЕЖИМА РАЗРАБОТКИ (VITE_DEMO_MODE=true в npm run dev).
 * Подставляет вымышленного ученика и локальную программу. В обычном режиме не подключается.
 */
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { CabinetContext, type CabinetValue } from '../cabinet/context';
import { getGroupLessons, getLesson } from '../data/course';
import { DemoSessionContext, type DemoSessionValue } from './context';
import { buildDemoScenario, isDemoStatus, type DemoStatus } from './scenarios';

const STORAGE_KEY = 'digex-demo-status';

function readStoredStatus(): DemoStatus {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v && isDemoStatus(v)) return v;
  } catch {
    // Хранилище недоступно — используем значение по умолчанию.
  }
  return 'active';
}

export function DemoSessionProvider({ children }: { children: ReactNode }) {
  const [demoStatus, setStatus] = useState<DemoStatus>(readStoredStatus);

  const setDemoStatus = useCallback((status: DemoStatus) => {
    setStatus(status);
    try {
      window.localStorage.setItem(STORAGE_KEY, status);
    } catch {
      // Не критично: выбор просто не запомнится.
    }
  }, []);

  const value = useMemo<DemoSessionValue>(
    () => ({ ...buildDemoScenario(demoStatus), demoStatus, setDemoStatus }),
    [demoStatus, setDemoStatus],
  );

  const cabinet = useMemo<CabinetValue>(() => {
    const hasAccess = value.access.status === 'active';
    return {
      mode: 'demo',
      user: value.user,
      access: value.access,
      sections: value.sections,
      payments: value.payments,
      results: value.results,
      stats: value.stats,
      availableLessons: hasAccess ? value.sections.reduce((n, s) => n + s.lessonsCount, 0) : 0,
      dataKey: `demo:${demoStatus}`,
      revision: 0,
      // Демо повторяет правило базы: без активного доступа уроки не отдаются.
      listLessons: async (sectionId) => (hasAccess ? getGroupLessons(sectionId) : []),
      getLesson: async (id) => (hasAccess ? (getLesson(id) ?? null) : null),
      reload: () => undefined,
      refreshError: null,
    };
  }, [value, demoStatus]);

  return (
    <DemoSessionContext.Provider value={value}>
      <CabinetContext.Provider value={cabinet}>{children}</CabinetContext.Provider>
    </DemoSessionContext.Provider>
  );
}
