/** Операции администратора. Роль проверяется в базе (RLS и функции с явной проверкой is_admin()). */
import type { AccessStatus } from '../types';
import { db, run, timeout } from './client';
import { LESSON_COLUMNS } from './learning';
import { ParseError, arr, bool, num, rec, status, str, strOrNull } from './parse';

export interface AdminGroup {
  id: string;
  title: string;
  description: string;
  sortOrder: number;
  archivedAt: string | null;
}

export interface AdminLesson {
  id: string;
  groupId: string;
  title: string;
  position: number;
  goal: string;
  content: string;
  examplePrompt: string;
  task: string;
  youtubeUrl: string | null;
  published: boolean;
  archivedAt: string | null;
}

export interface AdminPayment {
  id: string;
  amountSom: number;
  confirmedAt: string;
  startsAt: string;
  endsAt: string;
  revokedAt: string | null;
  revokeReason: string | null;
  status: AccessStatus;
}

export interface AdminStudent {
  id: string;
  fullName: string;
  email: string | null;
  role: 'student' | 'admin';
  createdAt: string;
  /** Периоды доступа к курсу, последний — первым. */
  payments: AdminPayment[];
}

const GROUP_COLUMNS = 'id, title, description, sort_order, archived_at';

function parseGroup(v: unknown): AdminGroup {
  const r = rec(v, 'группа');
  return {
    id: str(r, 'id'),
    title: str(r, 'title'),
    description: str(r, 'description'),
    sortOrder: num(r, 'sort_order'),
    archivedAt: strOrNull(r, 'archived_at'),
  };
}

function parseAdminLesson(v: unknown): AdminLesson {
  const r = rec(v, 'урок');
  return {
    id: str(r, 'id'),
    groupId: str(r, 'group_id'),
    title: str(r, 'title'),
    position: num(r, 'position'),
    goal: str(r, 'goal'),
    content: str(r, 'content'),
    examplePrompt: str(r, 'example_prompt'),
    task: str(r, 'task'),
    youtubeUrl: strOrNull(r, 'youtube_url'),
    published: bool(r, 'published'),
    archivedAt: strOrNull(r, 'archived_at'),
  };
}

function parseStudent(v: unknown): AdminStudent {
  const r = rec(v, 'ученик');
  const role = r.role === 'admin' ? 'admin' : 'student';
  return {
    id: str(r, 'id'),
    fullName: str(r, 'full_name'),
    email: strOrNull(r, 'email'),
    role,
    createdAt: str(r, 'created_at'),
    payments: arr(r.payments, 'оплаты').map((pv) => {
      const p = rec(pv, 'оплата');
      return {
        id: str(p, 'id'),
        amountSom: num(p, 'amount_som'),
        confirmedAt: str(p, 'confirmed_at'),
        startsAt: str(p, 'access_starts_at'),
        endsAt: str(p, 'access_ends_at'),
        revokedAt: strOrNull(p, 'revoked_at'),
        revokeReason: strOrNull(p, 'revoke_reason'),
        status: status(p, 'status'),
      };
    }),
  };
}

// --- Разделы (в базе — таблица groups)

export function listGroups(): Promise<AdminGroup[]> {
  return run(
    db().from('groups').select(GROUP_COLUMNS).order('sort_order').order('title').abortSignal(timeout()),
    (d) => arr(d, 'группы').map(parseGroup),
  );
}

export interface GroupInput {
  title: string;
  description: string;
  sortOrder: number;
}

export function createGroup(id: string, input: GroupInput): Promise<AdminGroup> {
  return run(
    db()
      .from('groups')
      .insert({ id, title: input.title, description: input.description, sort_order: input.sortOrder })
      .select(GROUP_COLUMNS)
      .abortSignal(timeout())
      .maybeSingle(),
    parseGroup,
  );
}

export function updateGroup(id: string, patch: Partial<GroupInput> & { archived?: boolean }): Promise<AdminGroup> {
  const row: Record<string, unknown> = {};
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.description !== undefined) row.description = patch.description;
  if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;
  if (patch.archived !== undefined) row.archived_at = patch.archived ? new Date().toISOString() : null;
  return run(
    db().from('groups').update(row).eq('id', id).select(GROUP_COLUMNS).abortSignal(timeout()).maybeSingle(),
    parseGroup,
  );
}

// --- Уроки

export function listAdminLessons(groupId: string): Promise<AdminLesson[]> {
  return run(
    db().from('lessons').select(LESSON_COLUMNS).eq('group_id', groupId).order('position').order('id').abortSignal(timeout()),
    (d) => arr(d, 'уроки').map(parseAdminLesson),
  );
}

export interface LessonInput {
  title: string;
  position: number;
  goal: string;
  content: string;
  examplePrompt: string;
  task: string;
  youtubeUrl: string | null;
  published: boolean;
}

function lessonRow(input: Partial<LessonInput>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (input.title !== undefined) row.title = input.title;
  if (input.position !== undefined) row.position = input.position;
  if (input.goal !== undefined) row.goal = input.goal;
  if (input.content !== undefined) row.content = input.content;
  if (input.examplePrompt !== undefined) row.example_prompt = input.examplePrompt;
  if (input.task !== undefined) row.task = input.task;
  if (input.youtubeUrl !== undefined) row.youtube_url = input.youtubeUrl;
  if (input.published !== undefined) row.published = input.published;
  return row;
}

export function createLesson(groupId: string, input: LessonInput): Promise<AdminLesson> {
  return run(
    db()
      .from('lessons')
      .insert({ group_id: groupId, ...lessonRow(input) })
      .select(LESSON_COLUMNS)
      .abortSignal(timeout())
      .maybeSingle(),
    parseAdminLesson,
  );
}

export function updateLesson(id: string, patch: Partial<LessonInput> & { archived?: boolean }): Promise<AdminLesson> {
  const row = lessonRow(patch);
  if (patch.archived !== undefined) row.archived_at = patch.archived ? new Date().toISOString() : null;
  return run(
    db().from('lessons').update(row).eq('id', id).select(LESSON_COLUMNS).abortSignal(timeout()).maybeSingle(),
    parseAdminLesson,
  );
}

export function moveLesson(id: string, direction: -1 | 1): Promise<boolean> {
  return run(
    db().rpc('admin_move_lesson', { p_lesson_id: id, p_direction: direction }).abortSignal(timeout()),
    (d) => bool(rec(d, 'перемещение'), 'moved'),
  );
}

// --- Ученики и общий доступ к курсу

export function studentsOverview(): Promise<AdminStudent[]> {
  return run(db().rpc('admin_students_overview').abortSignal(timeout()), (d) =>
    arr(d, 'ученики').map(parseStudent),
  );
}

/** Подтверждение оплаты курса. requestId один на попытку: повтор того же запроса не создаёт дубль. */
export function confirmPayment(studentId: string, amountSom: number, requestId: string): Promise<{ replayed: boolean }> {
  return run(
    db()
      .rpc('admin_confirm_payment', {
        p_student_id: studentId,
        p_amount_som: amountSom,
        p_request_id: requestId,
      })
      .abortSignal(timeout()),
    (d) => ({ replayed: bool(rec(d, 'оплата'), 'replayed') }),
  );
}

export function revokeAccess(paymentId: string, reason: string): Promise<{ alreadyRevoked: boolean }> {
  return run(
    db().rpc('admin_revoke_access', { p_payment_id: paymentId, p_reason: reason }).abortSignal(timeout()),
    (d) => ({ alreadyRevoked: bool(rec(d, 'отзыв'), 'already_revoked') }),
  );
}

// --- Тесты (вопросы с правильными ответами доступны только администратору — RLS)

export interface AdminQuestion {
  id: string;
  position: number;
  text: string;
  options: [string, string, string, string];
  correctIndex: number;
}

export interface AdminQuiz {
  id: string;
  published: boolean;
  version: number;
  questions: AdminQuestion[];
}

function parseQuestion(v: unknown): AdminQuestion {
  const r = rec(v, 'вопрос');
  const opts = arr(r.options, 'варианты');
  if (opts.length !== 4 || !opts.every((o) => typeof o === 'string')) throw new ParseError('варианты');
  return {
    id: str(r, 'id'),
    position: num(r, 'position'),
    text: str(r, 'text'),
    options: [opts[0], opts[1], opts[2], opts[3]] as [string, string, string, string],
    correctIndex: num(r, 'correct_index'),
  };
}

/** Тест урока с вопросами; null — теста ещё нет. */
/**
 * Тест урока для редактора: версия и вопросы приходят одним запросом (один снимок данных),
 * поэтому версия всегда соответствует показанному порядку — её проверяет admin_move_question.
 */
export function getLessonQuiz(lessonId: string): Promise<AdminQuiz | null> {
  return run(db().rpc('admin_get_quiz', { p_lesson_id: lessonId }).abortSignal(timeout()), (d) => {
    const quiz = rec(d, 'тест').quiz;
    if (quiz === null) return null;
    const r = rec(quiz, 'тест');
    return {
      id: str(r, 'id'),
      published: bool(r, 'published'),
      version: num(r, 'version'),
      questions: arr(r.questions, 'вопросы').map(parseQuestion),
    };
  });
}

/** Создание теста — функцией базы (проверка роли, один урок за вызов); повтор не создаёт второй тест. */
export function createQuiz(lessonId: string): Promise<void> {
  return run(db().rpc('admin_create_quiz', { p_lesson_id: lessonId }).abortSignal(timeout()), (d) => {
    rec(rec(d, 'создание теста').quiz, 'тест');
  });
}

export function setQuizPublished(quizId: string, published: boolean): Promise<void> {
  return run(
    db().from('quizzes').update({ published }).eq('id', quizId).select('id').abortSignal(timeout()).maybeSingle(),
    (d) => {
      if (d === null) throw new ParseError('тест не найден');
    },
  );
}

export interface QuestionInput {
  text: string;
  options: [string, string, string, string];
  correctIndex: number;
}

/**
 * Изменение вопросов — только через функции базы: они блокируют сначала тест, затем его вопросы
 * (единый порядок блокировок), проверяют роль и увеличивают версию теста. Прямой записи в таблицу у клиента нет.
 */
export function addQuestion(quizId: string, input: QuestionInput): Promise<void> {
  return run(
    db()
      .rpc('admin_add_question', {
        p_quiz_id: quizId,
        p_text: input.text,
        p_options: input.options,
        p_correct_index: input.correctIndex,
      })
      .abortSignal(timeout()),
    (d) => {
      rec(d, 'вопрос');
    },
  );
}

export function updateQuestion(id: string, input: QuestionInput): Promise<void> {
  return run(
    db()
      .rpc('admin_update_question', {
        p_question_id: id,
        p_text: input.text,
        p_options: input.options,
        p_correct_index: input.correctIndex,
      })
      .abortSignal(timeout()),
    (d) => {
      rec(d, 'вопрос');
    },
  );
}

export function deleteQuestion(id: string): Promise<void> {
  return run(db().rpc('admin_delete_question', { p_question_id: id }).abortSignal(timeout()), (d) => {
    bool(rec(d, 'удаление'), 'deleted');
  });
}

/** Перестановка относительно загруженного порядка: база отклонит её (quiz_version_conflict), если тест уже изменился. */
export function moveQuestion(id: string, direction: -1 | 1, expectedVersion: number): Promise<boolean> {
  return run(
    db()
      .rpc('admin_move_question', { p_question_id: id, p_direction: direction, p_expected_version: expectedVersion })
      .abortSignal(timeout()),
    (d) => bool(rec(d, 'перемещение'), 'moved'),
  );
}

// --- Результаты учеников

export interface AdminResult {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string | null;
  lessonId: string;
  lessonTitle: string;
  sectionId: string;
  sectionTitle: string;
  submittedAt: string;
  correct: number;
  total: number;
  percent: number;
}

export interface ResultFilters {
  studentId: string | null;
  sectionId: string | null;
  lessonId: string | null;
}

export function adminQuizResults(filters: ResultFilters): Promise<AdminResult[]> {
  return run(
    db()
      .rpc('admin_quiz_results', {
        p_student_id: filters.studentId,
        p_section_id: filters.sectionId,
        p_lesson_id: filters.lessonId,
      })
      .abortSignal(timeout()),
    (d) =>
      arr(d, 'результаты').map((v) => {
        const r = rec(v, 'результат');
        return {
          id: str(r, 'id'),
          studentId: str(r, 'student_id'),
          studentName: str(r, 'student_name'),
          studentEmail: strOrNull(r, 'student_email'),
          lessonId: str(r, 'lesson_id'),
          lessonTitle: str(r, 'lesson_title'),
          sectionId: str(r, 'section_id'),
          sectionTitle: str(r, 'section_title'),
          submittedAt: str(r, 'submitted_at'),
          correct: num(r, 'correct_count'),
          total: num(r, 'total_count'),
          percent: num(r, 'percent'),
        };
      }),
  );
}
