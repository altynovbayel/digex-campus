/**
 * Содержание курса: информация, направления и программа уроков.
 * Пока хранится в коде; в базу переносится на следующем этапе.
 * Здесь нет данных о пользователях — вымышленные ученики лежат в src/demo.
 */
import { DEMO_MODE } from '../config';
import { ACCESS_DAYS } from '../lib/access';
import type { CourseInfo, Group, Lesson } from '../types';
import { buildProgramLessons } from './lessons';

export const courseInfo: CourseInfo = {
  title: 'DIGEX Campus',
  tagline: 'Освой Claude и ChatGPT',
  description:
    'Научись использовать ИИ для учёбы, работы и повседневных задач: смотри уроки, практикуйся и закрепляй знания тестами.',
  // Реальной ссылки пока нет — показываем заглушку «Видео скоро появится».
  introVideoUrl: null,
  accessDays: ACCESS_DAYS,
  priceLabel: null,
};

/** Ровно два направления. */
export const courseGroups: Group[] = [
  { id: 'claude', title: 'Claude', description: 'Тексты, документы, запросы и рабочие задачи с Claude' },
  { id: 'chatgpt', title: 'ChatGPT', description: 'Идеи, обучение и повседневные задачи с ChatGPT' },
];

/**
 * Программа уроков (тексты, задания, вопросы и ответы) попадает в сборку ТОЛЬКО в режиме разработки.
 * В обычной сборке её нет: всё, что лежит в клиентском JavaScript, может прочитать любой посетитель,
 * а доступ к урокам должен проверяться в базе (RLS) — это следующий этап.
 */
export const courseLessons: Lesson[] = DEMO_MODE ? buildProgramLessons().map((l) => ({ ...l, published: true })) : [];

export function getGroup(id: string): Group | undefined {
  return courseGroups.find((g) => g.id === id);
}

export function getLesson(id: string): Lesson | undefined {
  return courseLessons.find((l) => l.id === id);
}

export function getGroupLessons(groupId: string): Lesson[] {
  return courseLessons.filter((l) => l.groupId === groupId).sort((a, b) => a.order - b.order);
}
