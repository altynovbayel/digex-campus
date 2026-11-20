/**
 * Данные кабинета ученика из базы. Один общий доступ к курсу открывает все разделы.
 * Содержание уроков отдаёт только RLS при действующем доступе (по серверному времени).
 */
import type { AttemptRecord, CourseAccess, Lesson, PaymentRecord, QuizForTaking, QuizStats, Section } from '../types';
import { db, run, timeout } from './client';
import { ParseError, arr, bool, num, rec, status, str, strOrNull } from './parse';

export const LESSON_COLUMNS =
  'id, group_id, title, position, goal, content, example_prompt, task, youtube_url, published, archived_at';

export function parseLesson(v: unknown): Lesson {
  const r = rec(v, 'урок');
  return {
    id: str(r, 'id'),
    groupId: str(r, 'group_id'),
    order: num(r, 'position'),
    title: str(r, 'title'),
    goal: str(r, 'goal'),
    content: str(r, 'content')
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean),
    examplePrompt: str(r, 'example_prompt'),
    task: str(r, 'task'),
    youtubeUrl: strOrNull(r, 'youtube_url'),
    // Тесты переносятся в базу на этапе 3Б.
    quiz: [],
    published: bool(r, 'published'),
  };
}

function parseSection(v: unknown): Section {
  const r = rec(v, 'раздел');
  return {
    id: str(r, 'id'),
    title: str(r, 'title'),
    description: str(r, 'description'),
    lessonsCount: num(r, 'lessons_count'),
  };
}

function parseCourseStatus(r: Record<string, unknown>): CourseAccess['status'] {
  const s = status(r, 'status');
  if (s === 'archived') throw new ParseError('status');
  return s;
}

function parsePayment(v: unknown): PaymentRecord {
  const r = rec(v, 'оплата');
  return {
    id: str(r, 'id'),
    amountSom: num(r, 'amount_som'),
    confirmedAt: str(r, 'confirmed_at'),
    startsAt: str(r, 'access_starts_at'),
    endsAt: str(r, 'access_ends_at'),
    revokedAt: strOrNull(r, 'revoked_at'),
    status: parseCourseStatus(r),
  };
}

const ATTEMPT_COLUMNS = 'id, lesson_id, lesson_title, section_id, section_title, submitted_at, correct_count, total_count, percent';

export function parseAttempt(v: unknown): AttemptRecord {
  const r = rec(v, 'попытка');
  return {
    id: str(r, 'id'),
    lessonId: str(r, 'lesson_id'),
    lessonTitle: str(r, 'lesson_title'),
    sectionId: str(r, 'section_id'),
    sectionTitle: str(r, 'section_title'),
    submittedAt: str(r, 'submitted_at'),
    correct: num(r, 'correct_count'),
    total: num(r, 'total_count'),
    percent: num(r, 'percent'),
  };
}

function parseStats(v: unknown): QuizStats {
  const r = rec(v, 'показатели');
  const avg = r.average_percent;
  return {
    testsPassed: num(r, 'tests_passed'),
    attempts: num(r, 'attempts'),
    averagePercent: avg === null || avg === undefined ? null : num(r, 'average_percent'),
    publishedTotal: num(r, 'published_total'),
    passedPublished: num(r, 'passed_published'),
    passedLessonIds: arr(r.passed_lesson_ids, 'пройденные уроки').map((x) => {
      if (typeof x !== 'string') throw new ParseError('пройденные уроки');
      return x;
    }),
  };
}

/** Размер страницы истории попыток (у API есть предел строк в ответе — грузим постранично). */
export const ATTEMPTS_PAGE_SIZE = 20;

/**
 * Страница СВОЕЙ истории попыток. Фильтр по student_id обязателен: у администратора RLS открывает все попытки,
 * а здесь нужны только его собственные. Стабильная сортировка: дата, затем id.
 */
export function fetchMyAttemptsPage(userId: string, offset: number): Promise<AttemptRecord[]> {
  return run(
    db()
      .from('quiz_attempts')
      .select(ATTEMPT_COLUMNS)
      .eq('student_id', userId)
      .order('submitted_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + ATTEMPTS_PAGE_SIZE - 1)
      .abortSignal(timeout()),
    (d) => arr(d, 'попытки').map(parseAttempt),
  );
}

export interface MyLearning {
  access: CourseAccess;
  sections: Section[];
  payments: PaymentRecord[];
  /** Первая страница своих попыток (остальные — fetchMyAttemptsPage). Доступны и после окончания доступа. */
  attempts: AttemptRecord[];
  stats: QuizStats;
  /** Число опубликованных уроков, доступных прямо сейчас (по RLS). */
  availableLessons: number;
  /** Разница «время сервера − время браузера», мс: для расчёта момента окончания доступа. */
  clockOffsetMs: number;
  /** Момент загрузки (время браузера): по нему страницы перепроверяют открытые материалы. */
  fetchedAt: number;
}

export async function fetchMyLearning(userId: string): Promise<MyLearning> {
  const client = db();
  let serverNow: string | null = null;
  // Поправка часов: серверное время относим к середине именно этого запроса (учёт сетевой задержки).
  const sentAt = Date.now();
  let receivedAt = sentAt;
  const [access, sections, payments, attempts, stats] = await Promise.all([
    run(client.rpc('my_access').abortSignal(timeout()), (d): CourseAccess => {
      receivedAt = Date.now();
      const r = rec(d, 'доступ');
      serverNow = strOrNull(r, 'server_now');
      return {
        status: parseCourseStatus(r),
        startsAt: strOrNull(r, 'access_starts_at'),
        endsAt: strOrNull(r, 'access_ends_at'),
        revokedAt: strOrNull(r, 'revoked_at'),
      };
    }),
    run(client.rpc('course_sections').abortSignal(timeout()), (d) => arr(d, 'разделы').map(parseSection)),
    run(client.rpc('my_payments').abortSignal(timeout()), (d) => arr(d, 'оплаты').map(parsePayment)),
    // Только свои попытки (явный фильтр), первая страница; ключи ответов (answers) не запрашиваем.
    fetchMyAttemptsPage(userId, 0),
    run(client.rpc('my_quiz_stats').abortSignal(timeout()), parseStats),
  ]);
  let availableLessons = 0;
  if (access.status === 'active') {
    const res = await client
      .from('lessons')
      .select('id', { count: 'exact', head: true })
      .eq('published', true)
      .is('archived_at', null)
      .abortSignal(timeout());
    availableLessons = await run(Promise.resolve({ data: res.count, error: res.error }), (d) =>
      typeof d === 'number' ? d : 0,
    );
  }
  const parsedNow = serverNow ? Date.parse(serverNow) : NaN;
  const clockOffsetMs = Number.isFinite(parsedNow) ? parsedNow - (sentAt + receivedAt) / 2 : 0;
  return { access, sections, payments, attempts, stats, availableLessons, clockOffsetMs, fetchedAt: Date.now() };
}

/** Опубликованные уроки раздела. Без действующего доступа RLS вернёт пустой список. */
export function fetchSectionLessons(sectionId: string): Promise<Lesson[]> {
  return run(
    db()
      .from('lessons')
      .select(LESSON_COLUMNS)
      .eq('group_id', sectionId)
      .eq('published', true)
      .is('archived_at', null)
      .order('position')
      .order('id')
      .abortSignal(timeout()),
    (d) => arr(d, 'уроки').map(parseLesson),
  );
}

/** Один урок. null — нет доступа, не опубликован или не существует (RLS не различает намеренно). */
export function fetchLesson(id: string): Promise<Lesson | null> {
  return run(
    db().from('lessons').select(LESSON_COLUMNS).eq('id', id).is('archived_at', null).abortSignal(timeout()).maybeSingle(),
    (d) => (d === null ? null : parseLesson(d)),
  );
}

export type QuizLoad = { status: 'ready'; quiz: QuizForTaking } | { status: 'no_access' } | { status: 'unavailable' };

/** Тест для прохождения: база отдаёт вопросы и варианты без правильных ответов и только при действующем доступе. */
export function fetchQuiz(lessonId: string): Promise<QuizLoad> {
  return run(db().rpc('get_quiz', { p_lesson_id: lessonId }).abortSignal(timeout()), (d): QuizLoad => {
    const r = rec(d, 'тест');
    if (r.status === 'no_access') return { status: 'no_access' };
    if (r.status !== 'ready') return { status: 'unavailable' };
    return {
      status: 'ready',
      quiz: {
        quizId: str(r, 'quiz_id'),
        version: num(r, 'version'),
        questions: arr(r.questions, 'вопросы').map((qv) => {
          const q = rec(qv, 'вопрос');
          const opts = arr(q.options, 'варианты');
          if (opts.length !== 4 || !opts.every((o) => typeof o === 'string')) throw new ParseError('варианты');
          return { id: str(q, 'id'), text: str(q, 'text'), options: [opts[0], opts[1], opts[2], opts[3]] as [string, string, string, string] };
        }),
      },
    };
  });
}

/**
 * Отправка попытки. Клиент передаёт только выбранные варианты — оценку считает база.
 * requestId один на попытку: повтор того же запроса вернёт ту же попытку (replayed).
 */
export function submitQuizAttempt(
  quizId: string,
  version: number,
  answers: { questionId: string; optionIndex: number }[],
  requestId: string,
): Promise<{ attempt: AttemptRecord; replayed: boolean }> {
  return run(
    db()
      .rpc('submit_quiz_attempt', {
        p_quiz_id: quizId,
        p_version: version,
        p_answers: answers.map((a) => ({ question_id: a.questionId, option_index: a.optionIndex })),
        p_request_id: requestId,
      })
      .abortSignal(timeout()),
    (d) => {
      const r = rec(d, 'результат');
      return { attempt: parseAttempt(r.attempt), replayed: bool(r, 'replayed') };
    },
  );
}
