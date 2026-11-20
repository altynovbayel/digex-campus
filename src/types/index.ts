/** Роли пользователей платформы. */
export type UserRole = 'student' | 'admin';

/**
 * Статус общего доступа к курсу (или периода оплаты). Вычисляется базой по серверному времени
 * (функции my_access, my_payments); в интерфейсе только отображается.
 * archived — только для разделов (раздел снят администратором).
 */
export type AccessStatus = 'not_activated' | 'active' | 'expired' | 'revoked' | 'archived';

/** Статус оплаты, который вручную подтверждает администратор. */
export type PaymentStatus = 'unpaid' | 'pending' | 'paid';

export interface CourseInfo {
  title: string;
  /** Заголовок основного блока главной страницы. */
  tagline: string;
  description: string;
  /** Ссылка на вводное видео YouTube. null — администратор ещё не добавил видео. */
  introVideoUrl: string | null;
  accessDays: number;
  /** Стоимость в виде текста, который задаёт администратор. null — не указана. */
  priceLabel: string | null;
}

export interface Group {
  id: string;
  title: string;
  description: string;
}

/** Ровно четыре варианта ответа. */
export type QuizOptions = readonly [string, string, string, string];

export interface QuizQuestion {
  id: string;
  text: string;
  options: QuizOptions;
  /** Индекс правильного варианта (0–3). В рабочей версии не должен приходить на клиент. */
  correctIndex: 0 | 1 | 2 | 3;
}

export interface Lesson {
  id: string;
  groupId: string;
  order: number;
  title: string;
  /** Краткая цель урока. */
  goal: string;
  /** Ссылка на видео YouTube. null — ещё не добавлена. */
  youtubeUrl: string | null;
  /** Текст урока, разбитый на абзацы. */
  content: string[];
  /** Пример запроса к ИИ на вымышленных данных. */
  examplePrompt: string;
  /** Практическое задание. */
  task: string;
  /** Только в демо-режиме. В обычном режиме тесты появятся на этапе 3Б (с проверкой на сервере). */
  quiz: QuizQuestion[];
  /** Опубликован ли урок (черновики видит только администратор). */
  published: boolean;
}

export interface AccessPeriod {
  /** ISO-дата активации администратором. null — не активирован. */
  activatedAt: string | null;
  /** ISO-дата окончания доступа. */
  expiresAt: string | null;
}

/** Ученик в демо-данных админки (только режим разработки). */
export interface Student {
  id: string;
  name: string;
  email: string;
  groupIds: string[];
  paymentStatus: PaymentStatus;
  access: AccessPeriod;
}

/** Текущий пользователь кабинета. */
export interface CabinetUser {
  id: string;
  name: string;
  email: string;
}

/** Раздел курса (Claude, ChatGPT): безопасные метаданные, доступны и до оплаты. */
export interface Section {
  id: string;
  title: string;
  description: string;
  /** Число опубликованных уроков раздела. */
  lessonsCount: number;
}

/** Общий доступ ко всему курсу: один период на все разделы. */
export interface CourseAccess {
  status: Exclude<AccessStatus, 'archived'>;
  startsAt: string | null;
  endsAt: string | null;
  revokedAt: string | null;
}

/** Подтверждённая оплата курса = общий период доступа на 14 суток. */
export interface PaymentRecord {
  id: string;
  amountSom: number;
  /** ISO-дата подтверждения. */
  confirmedAt: string;
  startsAt: string;
  endsAt: string;
  revokedAt: string | null;
  status: AccessStatus;
}

/** Попытка теста (результат). Баллы посчитаны базой; названия — снимок на момент отправки. */
export interface AttemptRecord {
  id: string;
  lessonId: string;
  lessonTitle: string;
  sectionId: string;
  sectionTitle: string;
  /** ISO-дата отправки (время сервера). */
  submittedAt: string;
  correct: number;
  total: number;
  percent: number;
}

/** Показатели тестирования — вычислены базой (my_quiz_stats). */
export interface QuizStats {
  /** Уникальные тесты, по которым есть попытка. */
  testsPassed: number;
  /** Все отправленные попытки. */
  attempts: number;
  /** Среднее по последней попытке каждого теста; null — попыток нет. */
  averagePercent: number | null;
  /** Опубликованные тесты доступной программы. */
  publishedTotal: number;
  /** Сколько из них пройдено. */
  passedPublished: number;
  /** Уроки, по тестам которых есть попытка (для отметки «Тест пройден»). */
  passedLessonIds: string[];
}

/** Тест для прохождения — без правильных ответов. */
export interface QuizForTaking {
  quizId: string;
  version: number;
  questions: { id: string; text: string; options: QuizOptions }[];
}
