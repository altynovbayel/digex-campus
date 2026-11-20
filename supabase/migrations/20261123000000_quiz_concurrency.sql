-- DIGEX Campus — этап 3Б, исправление конкурентных сценариев после ревью.
-- Применяется ПОСЛЕ 20261122000000_quiz_followups.sql. Предыдущие миграции не меняются.
--
-- 1. admin_move_lesson: блокировка уроков FOR NO KEY UPDATE (вместо FOR UPDATE) в порядке id —
--    перестановка уроков больше не ждёт и не блокирует FOR KEY SHARE (внешние ключи тестов и попыток,
--    admin_create_quiz), поэтому цепочка «публикация тестов → отправка → перестановка уроков → создание теста»
--    не замыкается во взаимную блокировку.
-- 2. submit_quiz_attempt: сначала FOR SHARE на тест, затем отдельным запросом из одного свежего снимка —
--    тест, урок и раздел (проверка публикации и архива согласована и актуальна на момент оценки).
-- Права на функции сохраняются: CREATE OR REPLACE не меняет ACL.

-- 1. Перестановка уроков -------------------------------------------------------------------------------------

create or replace function public.admin_move_lesson(p_lesson_id text, p_direction integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_lesson public.lessons;
  v_neighbor public.lessons;
begin
  perform public.assert_admin();
  if p_direction not in (-1, 1) then
    raise exception 'invalid_direction' using errcode = '22023';
  end if;

  select * into v_lesson from public.lessons where id = p_lesson_id;
  if not found then
    raise exception 'lesson_not_found' using errcode = 'P0002';
  end if;
  if v_lesson.archived_at is not null then
    raise exception 'lesson_archived' using errcode = 'P0001';
  end if;

  -- Блокируем уроки группы в стабильном порядке, чтобы параллельные перемещения не перемешали порядок,
  -- и нормализуем позиции активных уроков в 1..n (порядок прежний).
  -- FOR NO KEY UPDATE: перестановки по-прежнему сериализуются между собой, но не конфликтуют с FOR KEY SHARE,
  -- который берут проверки внешних ключей (вставка теста или попытки) и admin_create_quiz.
  -- Позиция не входит в уникальный индекс, поэтому UPDATE позиции тоже берёт только NO KEY UPDATE.
  perform 1 from public.lessons where group_id = v_lesson.group_id order by id for no key update;
  with ordered as (
    select id, row_number() over (order by position, id) as rn
    from public.lessons
    where group_id = v_lesson.group_id and archived_at is null
  )
  update public.lessons l set position = o.rn
  from ordered o
  where l.id = o.id and l.position <> o.rn;

  select * into v_lesson from public.lessons where id = p_lesson_id;
  select * into v_neighbor from public.lessons
  where group_id = v_lesson.group_id and archived_at is null and position = v_lesson.position + p_direction;
  if not found then
    return jsonb_build_object('moved', false);
  end if;

  update public.lessons set position = v_neighbor.position where id = v_lesson.id;
  update public.lessons set position = v_lesson.position where id = v_neighbor.id;
  return jsonb_build_object('moved', true);
end;
$$;

-- 2. Отправка попытки ----------------------------------------------------------------------------------------

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

  -- Шаг 1: блокировка теста на чтение (правка вопросов и публикация дождутся окончания оценки, и наоборот).
  perform 1 from public.quizzes where id = p_quiz_id for share;
  if not found then
    raise exception 'quiz_unavailable' using errcode = 'P0002';
  end if;
  -- Шаг 2: ОТДЕЛЬНЫЙ запрос без блокировок — при READ COMMITTED он получает новый снимок, взятый уже после
  -- получения блокировки. Тест, урок и раздел читаются из этого одного снимка, поэтому не смешиваются строка теста,
  -- перечитанная после ожидания, и урок/раздел из снимка до ожидания.
  select q as quiz, l as lesson, g as section into v_row
  from public.quizzes q
  join public.lessons l on l.id = q.lesson_id
  join public.groups g on g.id = l.group_id
  where q.id = p_quiz_id;
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
