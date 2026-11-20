/**
 * ТОЛЬКО ДЛЯ РЕЖИМА РАЗРАБОТКИ.
 * Сценарии вымышленного ученика для проверки интерфейса в разных состояниях общего доступа к курсу.
 */
import { courseGroups, getGroupLessons } from '../data/course';
import { addDays } from '../lib/access';
import type { AttemptRecord, CabinetUser, CourseAccess, PaymentRecord, QuizStats, Section } from '../types';

export type DemoStatus = CourseAccess['status'];

export interface DemoScenario {
  user: CabinetUser;
  access: CourseAccess;
  sections: Section[];
  payments: PaymentRecord[];
  results: AttemptRecord[];
  stats: QuizStats;
}

export function buildDemoScenario(status: DemoStatus, now: Date = new Date()): DemoScenario {
  const user = { id: 'demo-student', name: 'Демо Ученик', email: 'student@example.com' };
  const activated = status !== 'not_activated';
  const startsAt = status === 'active' || status === 'revoked' ? addDays(now, -3) : addDays(now, -20);
  const endsAt = addDays(startsAt, 14);
  const revokedAt = status === 'revoked' ? addDays(now, -1).toISOString() : null;

  return {
    user,
    access: {
      status,
      startsAt: activated ? startsAt.toISOString() : null,
      endsAt: activated ? endsAt.toISOString() : null,
      revokedAt,
    },
    sections: courseGroups.map((g) => ({
      id: g.id,
      title: g.title,
      description: g.description,
      lessonsCount: getGroupLessons(g.id).length,
    })),
    payments: activated
      ? [
          {
            id: 'demo-p-1',
            amountSom: 1500,
            confirmedAt: startsAt.toISOString(),
            startsAt: startsAt.toISOString(),
            endsAt: endsAt.toISOString(),
            revokedAt,
            status,
          },
        ]
      : [],
    results: [],
    // Демо без настоящих тестов: показатели нулевые.
    stats: { testsPassed: 0, attempts: 0, averagePercent: null, publishedTotal: 0, passedPublished: 0, passedLessonIds: [] },
  };
}

export const DEMO_STATUS_OPTIONS: { value: DemoStatus; label: string }[] = [
  { value: 'not_activated', label: 'Доступ не активирован' },
  { value: 'active', label: 'Доступ активен' },
  { value: 'expired', label: 'Срок истёк' },
  { value: 'revoked', label: 'Доступ отозван' },
];

export function isDemoStatus(v: string): v is DemoStatus {
  return DEMO_STATUS_OPTIONS.some((o) => o.value === v);
}
