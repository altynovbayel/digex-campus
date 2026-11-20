-- DIGEX Campus — этап 3Б: тесты к урокам, попытки, результаты и прогресс.
-- Применяется ПОСЛЕ 20261119000000_course_access.sql (использует has_course_access(), is_admin(), assert_admin()).
--
-- Тест: один на урок, несколько вопросов, 4 непустых варианта, один правильный, 1 балл за верный ответ.
-- Правильные ответы ученику не выдаются: таблицы вопросов доступны только администратору,
-- ученик получает тест функцией get_quiz() без ключа ответов. Баллы считает только база (submit_quiz_attempt).
-- Попытка хранит снимок вопросов и ответов: правка или снятие теста с публикации не меняет старые результаты.

-- 1. Таблицы ----------------------------------------------------------------------------------------

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  lesson_id text not null references public.lessons (id) on delete restrict
    constraint quizzes_lesson_unique unique,
  published boolean not null default false,
  -- Растёт при любом изменении вопросов: попытка, начатая на старой версии, не принимается.
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete restrict,
  position integer not null default 1
    constraint quiz_questions_position_range check (position between 1 and 1000),
  text text not null
    constraint quiz_questions_text_length check (char_length(btrim(text)) between 1 and 1000),
  options text[] not null
    constraint quiz_questions_four_options check (
      array_length(options, 1) = 4 and array_ndims(options) = 1
      and options[1] is not null and char_length(btrim(options[1])) between 1 and 500
      and options[2] is not null and char_length(btrim(options[2])) between 1 and 500
      and options[3] is not null and char_length(btrim(options[3])) between 1 and 500
      and options[4] is not null and char_length(btrim(options[4])) between 1 and 500
    ),
  -- Индекс правильного варианта: 0..3.
  correct_index smallint not null
    constraint quiz_questions_correct_range check (correct_index between 0 and 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index quiz_questions_quiz_idx on public.quiz_questions (quiz_id, position);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  -- restrict: результаты не исчезают вместе с пользователем.
  student_id uuid not null references public.profiles (id) on delete restrict,
  quiz_id uuid not null references public.quizzes (id) on delete restrict,
  lesson_id text not null references public.lessons (id) on delete restrict,
  quiz_version integer not null,
  -- Ключ идемпотентности от клиента: повтор одного запроса не создаёт вторую попытку.
  request_id uuid not null constraint quiz_attempts_request_unique unique,
  submitted_at timestamptz not null default now(),
  -- Снимок на момент отправки: названия, вопросы, варианты, выбранный и правильный ответ.
  lesson_title text not null,
  section_id text not null,
  section_title text not null,
  answers jsonb not null,
  correct_count integer not null constraint quiz_attempts_correct_range check (correct_count >= 0),
  total_count integer not null constraint quiz_attempts_total_range check (total_count > 0),
  percent integer not null constraint quiz_attempts_percent_range check (percent between 0 and 100),
  constraint quiz_attempts_correct_le_total check (correct_count <= total_count)
);

create index quiz_attempts_student_idx on public.quiz_attempts (student_id, submitted_at desc);
create index quiz_attempts_quiz_idx on public.quiz_attempts (quiz_id, student_id, submitted_at desc);

comment on table public.quiz_attempts is
  'Отправленные попытки тестов. Баллы считает submit_quiz_attempt(); снимок вопросов делает результат независимым от правок теста.';

-- 2. Триггеры: updated_at, версия, правила публикации -------------------------------------------------

create trigger quizzes_touch_updated_at before update on public.quizzes
  for each row execute function public.touch_updated_at();
create trigger quiz_questions_touch_updated_at before update on public.quiz_questions
  for each row execute function public.touch_updated_at();

-- Любое изменение вопросов увеличивает версию теста. SECURITY DEFINER: у клиентских ролей нет права менять version.
create function public.bump_quiz_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.quizzes set version = version + 1 where id = new.quiz_id;
  elsif tg_op = 'DELETE' then
    update public.quizzes set version = version + 1 where id = old.quiz_id;
  else
    update public.quizzes set version = version + 1 where id in (old.quiz_id, new.quiz_id);
  end if;
  return null;
end;
$$;

create trigger quiz_questions_bump_version after insert or update or delete on public.quiz_questions
  for each row execute function public.bump_quiz_version();

-- Пустой тест публиковать нельзя; вопрос нельзя перенести в другой тест.
create function public.check_quiz_publish()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.published and not exists (select 1 from public.quiz_questions where quiz_id = new.id) then
    raise exception 'quiz_empty' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger quizzes_check_publish before insert or update of published on public.quizzes
  for each row execute function public.check_quiz_publish();

create function public.check_quiz_question_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.quiz_id is distinct from old.quiz_id then
    raise exception 'question_quiz_immutable' using errcode = '23514';
  end if;
  -- Удаление последнего вопроса опубликованного теста сделало бы его пустым.
  -- Сначала блокируем строку теста: параллельные удаления и публикация выполняются по очереди,
  -- и проверка ниже видит уже зафиксированное состояние (READ COMMITTED, новый снимок на запрос).
  if tg_op = 'DELETE' then
    perform 1 from public.quizzes where id = old.quiz_id for update;
  end if;
  if tg_op = 'DELETE'
     and exists (select 1 from public.quizzes where id = old.quiz_id and published)
     and not exists (select 1 from public.quiz_questions where quiz_id = old.quiz_id and id <> old.id) then
    raise exception 'quiz_last_question' using errcode = '23514';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger quiz_questions_check_change before update or delete on public.quiz_questions
  for each row execute function public.check_quiz_question_change();

revoke all on function public.bump_quiz_version() from public, anon, authenticated;
revoke all on function public.check_quiz_publish() from public, anon, authenticated;
revoke all on function public.check_quiz_question_change() from public, anon, authenticated;

-- 3. RLS и права (Automatically expose new tables выключен — выдаём явно) --------------------------------

alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_attempts enable row level security;

-- Тесты и вопросы (с ключом ответов) — только администратору. Ученик получает тест через get_quiz().
create policy "quizzes: admins read" on public.quizzes for select to authenticated using ((select public.is_admin()));
create policy "quizzes: admins insert" on public.quizzes for insert to authenticated with check ((select public.is_admin()));
create policy "quizzes: admins update" on public.quizzes for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "quiz_questions: admins read" on public.quiz_questions for select to authenticated
  using ((select public.is_admin()));
create policy "quiz_questions: admins insert" on public.quiz_questions for insert to authenticated
  with check ((select public.is_admin()));
create policy "quiz_questions: admins update" on public.quiz_questions for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "quiz_questions: admins delete" on public.quiz_questions for delete to authenticated
  using ((select public.is_admin()));

-- Попытки: свои (в том числе после окончания доступа) или все для администратора. Запись — только функцией.
create policy "quiz_attempts: read own" on public.quiz_attempts for select to authenticated
  using (student_id = (select auth.uid()));
create policy "quiz_attempts: admins read" on public.quiz_attempts for select to authenticated
  using ((select public.is_admin()));

revoke all on table public.quizzes, public.quiz_questions, public.quiz_attempts from anon, authenticated;
grant select on table public.quizzes, public.quiz_questions, public.quiz_attempts to authenticated;
grant insert (lesson_id, published) on table public.quizzes to authenticated;
grant update (published) on table public.quizzes to authenticated;
grant insert (quiz_id, position, text, options, correct_index) on table public.quiz_questions to authenticated;
grant update (position, text, options, correct_index) on table public.quiz_questions to authenticated;
grant delete on table public.quiz_questions to authenticated;
-- quiz_attempts: INSERT/UPDATE/DELETE клиентским ролям не выдаются.

-- 4. Ученик: получение теста без ответов ----------------------------------------------------------------

-- Тест урока для прохождения: только при действующем общем доступе, опубликованном уроке, разделе и тесте.
-- Возвращает вопросы и варианты БЕЗ правильного ответа и версию теста.
create function public.get_quiz(p_lesson_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_quiz public.quizzes;
begin
  if (select auth.uid()) is null then
    raise exception 'auth_required' using errcode = '42501';
  end if;
  if not public.has_course_access() then
    return jsonb_build_object('status', 'no_access');
  end if;

  select q.* into v_quiz
  from public.quizzes q
  join public.lessons l on l.id = q.lesson_id
  join public.groups g on g.id = l.group_id
  where q.lesson_id = p_lesson_id
    and q.published and l.published and l.archived_at is null and g.archived_at is null;
  if not found then
    return jsonb_build_object('status', 'unavailable');
  end if;

  return jsonb_build_object(
    'status', 'ready',
    'quiz_id', v_quiz.id,
    'version', v_quiz.version,
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object('id', qq.id, 'text', qq.text, 'options', to_jsonb(qq.options))
        order by qq.position, qq.id)
      from public.quiz_questions qq where qq.quiz_id = v_quiz.id
    ), '[]'::jsonb)
  );
end;
$$;

-- 5. Ученик: отправка попытки, оценка на сервере ------------------------------------------------------------
-- p_answers: [{"question_id": "<uuid>", "option_index": 0..3}, ...] — ровно по одному ответу на каждый вопрос теста.
create function public.submit_quiz_attempt(p_quiz_id uuid, p_version integer, p_answers jsonb, p_request_id uuid)
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

  -- Блокировка теста на чтение: правка вопросов (смена версии) дождётся окончания оценки, и наоборот.
  select * into v_quiz from public.quizzes where id = p_quiz_id for share;
  if not found then
    raise exception 'quiz_unavailable' using errcode = 'P0002';
  end if;
  select * into v_lesson from public.lessons where id = v_quiz.lesson_id;
  select * into v_section from public.groups where id = v_lesson.group_id;
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

-- 6. Ученик: показатели из базы -------------------------------------------------------------------------

-- tests_passed      — уникальные тесты, по которым есть попытка;
-- attempts          — все отправленные попытки;
-- average_percent   — среднее по ПОСЛЕДНЕЙ попытке каждого теста (null — попыток нет);
-- published_total   — опубликованные тесты доступной программы (урок и раздел опубликованы, не в архиве);
-- passed_published  — сколько из них пройдено (для прогресса);
-- passed_lesson_ids — уроки, по тестам которых есть попытка (отметка «Тест пройден» без загрузки всей истории).
create function public.my_quiz_stats()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select * from public.quiz_attempts where student_id = (select auth.uid())
  ),
  last_per_quiz as (
    select distinct on (quiz_id) quiz_id, percent
    from mine order by quiz_id, submitted_at desc, id desc
  ),
  program as (
    select q.id
    from public.quizzes q
    join public.lessons l on l.id = q.lesson_id
    join public.groups g on g.id = l.group_id
    where q.published and l.published and l.archived_at is null and g.archived_at is null
  )
  select jsonb_build_object(
    'tests_passed', (select count(distinct quiz_id) from mine),
    'attempts', (select count(*) from mine),
    'average_percent', (select round(avg(percent))::integer from last_per_quiz),
    'published_total', (select count(*) from program),
    'passed_published', (select count(*) from program p where exists (select 1 from mine m where m.quiz_id = p.id)),
    'passed_lesson_ids', coalesce((select jsonb_agg(distinct lesson_id) from mine), '[]'::jsonb)
  )
  where (select auth.uid()) is not null;
$$;

-- 7. Администратор: результаты с фильтрами ----------------------------------------------------------------

create function public.admin_quiz_results(
  p_student_id uuid default null,
  p_section_id text default null,
  p_lesson_id text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin();
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
        'id', a.id,
        'student_id', a.student_id,
        'student_name', pr.full_name,
        'student_email', u.email,
        'lesson_id', a.lesson_id,
        'lesson_title', a.lesson_title,
        'section_id', a.section_id,
        'section_title', a.section_title,
        'submitted_at', a.submitted_at,
        'correct_count', a.correct_count,
        'total_count', a.total_count,
        'percent', a.percent
      ) order by a.submitted_at desc), '[]'::jsonb)
    from public.quiz_attempts a
    join public.profiles pr on pr.id = a.student_id
    left join auth.users u on u.id = a.student_id
    where (p_student_id is null or a.student_id = p_student_id)
      and (p_section_id is null or a.section_id = p_section_id)
      and (p_lesson_id is null or a.lesson_id = p_lesson_id)
  );
end;
$$;

-- Перемещение вопроса на одну позицию внутри теста — атомарный обмен с соседом.
create function public.admin_move_question(p_question_id uuid, p_direction integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_q public.quiz_questions;
  v_n public.quiz_questions;
begin
  perform public.assert_admin();
  if p_direction not in (-1, 1) then
    raise exception 'invalid_direction' using errcode = '22023';
  end if;
  select * into v_q from public.quiz_questions where id = p_question_id;
  if not found then
    raise exception 'question_not_found' using errcode = 'P0002';
  end if;
  -- Порядок блокировок как у правки и удаления вопроса (сначала вопросы, затем тест) — без взаимной блокировки.
  perform 1 from public.quiz_questions where quiz_id = v_q.quiz_id order by id for update;
  perform 1 from public.quizzes where id = v_q.quiz_id for update;
  select * into v_q from public.quiz_questions where id = p_question_id;
  if not found then
    raise exception 'question_not_found' using errcode = 'P0002';
  end if;
  -- Нормализация позиций 1..n (порядок прежний).
  with ordered as (
    select id, row_number() over (order by position, id) as rn from public.quiz_questions where quiz_id = v_q.quiz_id
  )
  update public.quiz_questions qq set position = o.rn from ordered o where qq.id = o.id and qq.position <> o.rn;
  select * into v_q from public.quiz_questions where id = p_question_id;
  select * into v_n from public.quiz_questions where quiz_id = v_q.quiz_id and position = v_q.position + p_direction;
  if not found then
    return jsonb_build_object('moved', false);
  end if;
  update public.quiz_questions set position = v_n.position where id = v_q.id;
  update public.quiz_questions set position = v_q.position where id = v_n.id;
  return jsonb_build_object('moved', true);
end;
$$;

revoke all on function public.get_quiz(text) from public, anon;
revoke all on function public.submit_quiz_attempt(uuid, integer, jsonb, uuid) from public, anon;
revoke all on function public.my_quiz_stats() from public, anon;
revoke all on function public.admin_quiz_results(uuid, text, text) from public, anon;
revoke all on function public.admin_move_question(uuid, integer) from public, anon;
grant execute on function public.get_quiz(text) to authenticated;
grant execute on function public.submit_quiz_attempt(uuid, integer, jsonb, uuid) to authenticated;
grant execute on function public.my_quiz_stats() to authenticated;
grant execute on function public.admin_quiz_results(uuid, text, text) to authenticated;
grant execute on function public.admin_move_question(uuid, integer) to authenticated;
