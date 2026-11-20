import { createContext } from 'react';
import type { AttemptRecord, CabinetUser, CourseAccess, Lesson, PaymentRecord, QuizStats, Section } from '../types';

/**
 * Данные кабинета ученика.
 * mode = 'live' — настоящий пользователь, всё из базы (доступ проверяет RLS);
 * mode = 'demo' — вымышленный ученик, только режим разработки.
 */
export interface CabinetValue {
  mode: 'live' | 'demo';
  user: CabinetUser;
  /** Общий доступ ко всему курсу (один период на все разделы). */
  access: CourseAccess;
  /** Разделы курса — видны всем вошедшим, независимо от оплаты. */
  sections: Section[];
  /** История подтверждённых оплат. */
  payments: PaymentRecord[];
  /** Свои попытки тестов (последние — первыми). */
  results: AttemptRecord[];
  /** Показатели тестирования из базы. */
  stats: QuizStats;
  /** Число уроков, доступных прямо сейчас. */
  availableLessons: number;
  /** Ключ данных текущей сессии: запросы уроков привязываются к нему. */
  dataKey: string;
  /** Меняется при каждом обновлении данных кабинета: открытые материалы перепроверяются на сервере. */
  revision: number;
  listLessons: (sectionId: string) => Promise<Lesson[]>;
  getLesson: (id: string) => Promise<Lesson | null>;
  reload: () => void;
  /** Фоновое обновление не удалось: на экране последние загруженные данные. */
  refreshError: string | null;
}

export const CabinetContext = createContext<CabinetValue | null>(null);
