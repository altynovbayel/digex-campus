-- DIGEX Campus — этап 3Б, исправления после ревью блокировок.
-- Применяется ПОСЛЕ 20261121000000_quiz_write_locks.sql. Предыдущие миграции не меняются.
--
-- 1. Создание теста — только функцией admin_create_quiz() (один урок за вызов, проверка роли);
--    прямой INSERT в quizzes у клиентских ролей отозван. Порядок блокировок: урок (FOR KEY SHARE) → тест.
-- 2. submit_quiz_attempt: тест, урок и раздел читаются одним запросом (согласованный снимок).
-- 3. admin_add_question: при выходе следующей позиции за предел (1000) позиции нормализуются в 1..n
--    под уже взятой блокировкой; вопросы не удаляются, попытки не меняются. Предел — число вопросов.
-- Протокол блокировок сохраняется: тест (FOR UPDATE) → вопросы (ORDER BY id) → запись.

-- 1. Создание теста ---------------------------------------------------------------------------------------

drop policy "quizzes: admins insert" on public.quizzes;
-- Отзыв на уровне таблицы снимает и выданные ранее права на колонки (lesson_id, published).
revoke insert on table public.quizzes from anon, authenticated;
-- UPDATE (published) для администратора сохраняется: публикация блокирует только строку теста.

create function public.admin_create_quiz(p_lesson_id text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_quiz public.quizzes;
begin
  perform public.assert_admin();
  -- Урок первым и в той же силе, что и проверка внешнего ключа: один урок за вызов — встречных ожиданий нет.
  perform 1 from public.lessons where id = p_lesson_id for key share;
  if not found then
    raise exception 'lesson_not_found' using errcode = 'P0002';
  end if;
  insert into public.quizzes (lesson_id, published) values (p_lesson_id, false)
  on conflict (lesson_id) do nothing
  returning * into v_quiz;
  if v_quiz.id is null then
    -- Тест уже есть (повтор запроса или параллельное создание) — возвращаем существующий.
    select * into v_quiz from public.quizzes where lesson_id = p_lesson_id;
    return jsonb_build_object('quiz', to_jsonb(v_quiz), 'created', false);
  end if;
  return jsonb_build_object('quiz', to_jsonb(v_quiz), 'created', true);
end;
$$;

revoke all on function public.admin_create_quiz(text) from public, anon;
grant execute on function public.admin_create_quiz(text) to authenticated;

-- 2. Согласованная проверка урока и раздела при отправке попытки --------------------------------------------

create or replace function public.submit_quiz_attempt(p_quiz_id uuid, p_version integer, p_answers jsonb, p_request_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_quiz public.quizzes;
  v_lesson public.lessons;
  v_section public.groups;
  v_row record;
  v_attempt public.quiz_attempts;
  v_total integer;
  v_answer_count integer;
  v_valid_count integer;
  v_correct integer;
  v_snapshot jsonb;
begin
  if v_uid is null then
    raise exception 'auth_required' using errcode = '42501';
  end if;
  if p_request_id is null then
    raise exception 'request_id_required' using errcode = '22023';
  end if;

  -- Повтор того же запроса: возвращаем уже сохранённую попытку (до проверки доступа — ответ тот же).
  select * into v_attempt from public.quiz_attempts where request_id = p_request_id;
  if found then
    if v_attempt.student_id <> v_uid or v_attempt.quiz_id <> p_quiz_id then
      raise exception 'request_id_conflict' using errcode = '22023';
    end if;
    return jsonb_build_object('attempt', to_jsonb(v_attempt) - 'answers', 'replayed', true);
  end if;

  -- Тест, урок и раздел читаются ОДНИМ запросом (один снимок данных): нельзя совместить состояние урока и раздела,
  -- которые не действовали одновременно. Блокировка теста на чтение: правка вопросов дождётся окончания оценки.
  select q as quiz, l as lesson, g as section into v_row
  from public.quizzes q
  join public.lessons l on l.id = q.lesson_id
  join public.groups g on g.id = l.group_id
  where q.id = p_quiz_id
  for share of q;
  if not found then
    raise exception 'quiz_unavailable' using errcode = 'P0002';
  end if;
  v_quiz := v_row.quiz;
  v_lesson := v_row.lesson;
  v_section := v_row.section;
  if not v_quiz.published or not v_lesson.published or v_lesson.archived_at is not null
     or v_section.archived_at is not null then
    raise exception 'quiz_unavailable' using errcode = 'P0001';
  end if;
  -- Доступ проверяется по серверному времени в момент отправки.
  if not public.has_course_access() then
    raise exception 'access_required' using errcode = '42501';
  end if;
  if p_version is distinct from v_quiz.version then
    raise exception 'quiz_changed' using errcode = 'P0001';
  end if;

  -- Ответы: массив объектов; все вопросы этого теста ровно по одному разу; вариант 0..3.
  if p_answers is null or jsonb_typeof(p_answers) <> 'array' then
    raise exception 'answers_invalid' using errcode = '22023';
  end if;
  select count(*) into v_total from public.quiz_questions where quiz_id = v_quiz.id;
  v_answer_count := jsonb_array_length(p_answers);

  select count(distinct qq.id) into v_valid_count
  from jsonb_array_elements(p_answers) a
  join public.quiz_questions qq
    on qq.quiz_id = v_quiz.id
   -- Сравнение текстом, без приведения типа: некорректная строка просто не совпадёт.
   and qq.id::text = lower(a ->> 'question_id')
  where jsonb_typeof(a) = 'object'
    and jsonb_typeof(a -> 'question_id') = 'string'
    and jsonb_typeof(a -> 'option_index') = 'number'
    and (a ->> 'option_index') in ('0', '1', '2', '3');

  if v_total = 0 or v_answer_count <> v_total or v_valid_count <> v_total then
    raise exception 'answers_invalid' using errcode = '22023';
  end if;

  -- Оценка и снимок (вопросы в порядке теста).
  select
    count(*) filter (where (a.ans ->> 'option_index')::smallint = qq.correct_index),
    jsonb_agg(jsonb_build_object(
      'question_id', qq.id,
      'text', qq.text,
      'options', to_jsonb(qq.options),
      'selected_index', (a.ans ->> 'option_index')::smallint,
      'correct_index', qq.correct_index,
      'is_correct', (a.ans ->> 'option_index')::smallint = qq.correct_index
    ) order by qq.position, qq.id)
  into v_correct, v_snapshot
  from public.quiz_questions qq
  join lateral (
    select e as ans from jsonb_array_elements(p_answers) e
    where lower(e ->> 'question_id') = qq.id::text
  ) a on true
  where qq.quiz_id = v_quiz.id;

  insert into public.quiz_attempts (
    student_id, quiz_id, lesson_id, quiz_version, request_id,
    lesson_title, section_id, section_title, answers, correct_count, total_count, percent
  ) values (
    v_uid, v_quiz.id, v_lesson.id, v_quiz.version, p_request_id,
    v_lesson.title, v_section.id, v_section.title, v_snapshot, v_correct, v_total,
    round(100.0 * v_correct / v_total)::integer
  )
  on conflict (request_id) do nothing
  returning * into v_attempt;

  if v_attempt.id is null then
    -- Параллельный повтор того же запроса успел сохранить попытку.
    select * into v_attempt from public.quiz_attempts where request_id = p_request_id;
    if v_attempt.student_id <> v_uid or v_attempt.quiz_id <> p_quiz_id then
      raise exception 'request_id_conflict' using errcode = '22023';
    end if;
    return jsonb_build_object('attempt', to_jsonb(v_attempt) - 'answers', 'replayed', true);
  end if;

  return jsonb_build_object('attempt', to_jsonb(v_attempt) - 'answers', 'replayed', false);
end;
$$;

-- 3. Добавление вопроса: нормализация позиций при достижении предела ------------------------------------------

create or replace function public.admin_add_question(p_quiz_id uuid, p_text text, p_options text[], p_correct_index integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_question public.quiz_questions;
  v_count integer;
  v_next integer;
begin
  perform public.assert_admin();
  perform public.lock_quiz_for_write(p_quiz_id);
  select count(*), coalesce(max(position), 0) + 1 into v_count, v_next
  from public.quiz_questions where quiz_id = p_quiz_id;
  -- Предел — число вопросов (ограничение позиции 1..1000), а не значение последней позиции.
  if v_count >= 1000 then
    raise exception 'quiz_too_many_questions' using errcode = '23514';
  end if;
  if v_next > 1000 then
    -- Разреженные позиции (например, после прежней прямой записи): перенумеровать 1..n, порядок прежний.
    with ordered as (
      select id, row_number() over (order by position, id) as rn from public.quiz_questions where quiz_id = p_quiz_id
    )
    update public.quiz_questions qq set position = o.rn from ordered o where qq.id = o.id and qq.position <> o.rn;
    v_next := v_count + 1;
  end if;
  insert into public.quiz_questions (quiz_id, position, text, options, correct_index)
  values (p_quiz_id, v_next, btrim(p_text), p_options, p_correct_index)
  returning * into v_question;
  return to_jsonb(v_question);
end;
$$;
-- Права submit_quiz_attempt и admin_add_question сохраняются: CREATE OR REPLACE не меняет ACL.
