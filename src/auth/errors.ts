import { isAuthError, isAuthRetryableFetchError, isAuthWeakPasswordError } from '@supabase/supabase-js';

/** Максимальное ожидание запроса к базе (с учётом встроенных повторов клиента). */
export const DB_TIMEOUT_MS = 15_000;

const NETWORK = 'Не удалось связаться с сервером. Проверьте подключение к интернету и попробуйте ещё раз.';

/** Понятное сообщение об ошибке авторизации. */
export function authErrorMessage(error: unknown): string {
  if (isAuthRetryableFetchError(error)) return NETWORK;
  if (isAuthWeakPasswordError(error)) {
    return 'Пароль слишком простой. Используйте не меньше 8 символов, буквы и цифры.';
  }
  if (isAuthError(error)) {
    switch (error.code) {
      case 'invalid_credentials':
        return 'Неверный email или пароль.';
      case 'email_not_confirmed':
        return 'Email ещё не подтверждён. Откройте ссылку из письма или отправьте письмо повторно.';
      case 'user_already_exists':
      case 'email_exists':
        return 'Аккаунт с таким email уже существует. Войдите или восстановите пароль.';
      case 'weak_password':
        return 'Пароль слишком простой. Используйте не меньше 8 символов, буквы и цифры.';
      case 'same_password':
        return 'Новый пароль должен отличаться от текущего.';
      case 'email_address_invalid':
      case 'validation_failed':
        return 'Проверьте правильность email.';
      case 'over_email_send_rate_limit':
      case 'over_request_rate_limit':
        return 'Слишком много попыток. Подождите несколько минут и попробуйте снова.';
      case 'signup_disabled':
      case 'email_provider_disabled':
        return 'Регистрация сейчас отключена. Обратитесь к администратору.';
      case 'otp_expired':
        return 'Ссылка устарела. Запросите новое письмо.';
      default:
        break;
    }
    if (error.status === 0 || error.status === undefined) return NETWORK;
  }
  if (error instanceof TypeError) return NETWORK;
  return 'Что-то пошло не так. Попробуйте ещё раз.';
}

interface DbError {
  code?: string;
  message?: string;
}

/** Коды, которые возвращают функции базы (raise exception '<код>'). */
const RPC_MESSAGES: Record<string, string> = {
  admin_required: 'Действие доступно только администратору.',
  access_already_active:
    'У ученика уже есть действующий доступ к курсу. Новый период можно подтвердить после окончания или отзыва текущего.',
  request_id_conflict: 'Этот запрос уже был отправлен с другими данными. Обновите форму и повторите.',
  request_id_required: 'Не удалось сформировать запрос. Обновите страницу.',
  invalid_amount: 'Укажите сумму больше нуля (не более двух знаков после запятой).',
  student_not_found: 'Ученик не найден.',
  group_not_found: 'Раздел не найден или находится в архиве.',
  payment_not_found: 'Оплата не найдена.',
  access_not_active: 'Этот период доступа уже закончился — отзывать нечего.',
  lesson_not_found: 'Урок не найден.',
  lesson_archived: 'Урок в архиве. Сначала верните его из архива.',
  invalid_direction: 'Неверное направление перемещения.',
  quiz_empty: 'Нельзя опубликовать пустой тест: добавьте хотя бы один вопрос.',
  quiz_last_question: 'Нельзя удалить последний вопрос опубликованного теста. Сначала снимите тест с публикации.',
  question_quiz_immutable: 'Вопрос нельзя перенести в другой тест.',
  question_not_found: 'Вопрос не найден — возможно, его уже удалили. Обновите тест.',
  attempt_not_found: 'Попытка не найдена.',
  quiz_too_many_questions: 'В тесте уже максимальное число вопросов.',
  quiz_not_found: 'Тест не найден — возможно, страница устарела. Обновите её.',
  quiz_changed: 'Тест изменился, пока вы его проходили. Загрузите его заново.',
  quiz_version_conflict: 'Тест изменился с момента загрузки — порядок не изменён. Проверьте актуальный порядок и повторите.',
  quiz_unavailable: 'Тест сейчас недоступен: он снят с публикации или урок закрыт.',
  access_required: 'Доступ к курсу закончился или отозван — попытка не принята.',
  answers_invalid: 'Ответы не приняты: ответьте на каждый вопрос ровно один раз.',
  auth_required: 'Нужно войти в аккаунт.',
};

const CHECK_MESSAGES: Record<string, string> = {
  groups_id_format: 'Идентификатор раздела: 2–40 символов, строчные латинские буквы, цифры и дефис.',
  groups_title_length: 'Название раздела: от 1 до 100 символов.',
  groups_description_length: 'Описание раздела: не более 500 символов.',
  lessons_title_length: 'Название урока: от 1 до 200 символов.',
  lessons_position_range: 'Порядок урока: число от 1 до 10000.',
  lessons_youtube_url: 'Ссылка должна вести на видео YouTube (https://www.youtube.com/watch?v=… или https://youtu.be/…).',
  lessons_goal_length: 'Цель урока: не более 1000 символов.',
  lessons_content_length: 'Текст урока: не более 50 000 символов.',
  lessons_prompt_length: 'Пример запроса: не более 5000 символов.',
  lessons_task_length: 'Практическое задание: не более 5000 символов.',
  profiles_full_name_length: 'Имя должно быть от 1 до 100 символов.',
  course_payments_amount_range: 'Сумма должна быть больше нуля.',
  quiz_questions_text_length: 'Текст вопроса: от 1 до 1000 символов.',
  quiz_questions_four_options: 'Нужно ровно четыре непустых варианта ответа (до 500 символов каждый).',
  quiz_questions_correct_range: 'Выберите правильный вариант.',
  quiz_questions_position_range: 'Порядок вопроса: число от 1 до 1000.',
};

/** Понятное сообщение об ошибке запроса к таблицам и функциям базы. */
export function dbErrorMessage(error: DbError | null | undefined): string {
  if (!error) return 'Неизвестная ошибка базы данных.';
  const message = error.message ?? '';
  const rpc = RPC_MESSAGES[message.trim()];
  if (rpc) return rpc;
  if (error.code === '23505') return 'Запись с таким идентификатором уже существует.';
  if (error.code === '23514') {
    const constraint = Object.keys(CHECK_MESSAGES).find((c) => message.includes(c));
    return constraint ? (CHECK_MESSAGES[constraint] ?? 'Значение не прошло проверку.') : 'Значение не прошло проверку.';
  }
  if (error.code === '42883' || error.code === 'PGRST202') {
    return 'Функция базы не найдена: выполните все миграции по порядку из README (раздел «Настройка Supabase»), включая новые.';
  }
  if (error.code === '42P01' || error.code === 'PGRST205') {
    return 'Таблица не найдена: примените миграции Supabase (см. README).';
  }
  if (error.code === '42501') return 'Недостаточно прав для этого действия.';
  if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) return NETWORK;
  if (error.code === '20' || /abort|timeout/i.test(error.message ?? '')) {
    return 'Сервер не ответил вовремя. Проверьте подключение и попробуйте ещё раз.';
  }
  return 'Не удалось выполнить запрос к базе данных. Попробуйте ещё раз.';
}
