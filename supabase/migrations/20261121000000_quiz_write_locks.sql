-- DIGEX Campus — этап 3Б, исправление: единый порядок блокировок при изменении тестов.
-- Применяется ПОСЛЕ 20261120000000_quizzes.sql (она могла быть уже применена и не меняется).
--
-- Проблема: перестановка вопроса блокировала вопросы, затем тест, а прямой DELETE нескольких вопросов через API
-- блокировал строки вопросов в произвольном порядке и затем тест (в BEFORE-триггере) — встречные ожидания
-- приводили к взаимной блокировке (40P01).
--
-- Протокол для ВСЕХ операций, изменяющих тест и его вопросы:
--   1) строка теста: SELECT … FROM quizzes … FOR UPDATE;
--   2) все вопросы этого теста в стабильном порядке: … ORDER BY id FOR UPDATE;
--   3) изменение.
-- Изменение вопросов — только через функции ниже. Прямые INSERT/UPDATE/DELETE на quiz_questions
-- у клиентских ролей отозваны, поэтому обойти протокол через API нельзя.
-- Остальные пути: публикация/создание теста (UPDATE/INSERT quizzes) блокируют только строку теста — шаг 1 протокола;
-- submit_quiz_attempt берёт тест FOR SHARE и вопросы не блокирует; AFTER-триггер версии обновляет уже
-- заблокированную строку теста.

-- 1. Прямая запись в вопросы клиентам запрещена --------------------------------------------------------

drop policy "quiz_questions: admins insert" on public.quiz_questions;
drop policy "quiz_questions: admins update" on public.quiz_questions;
drop policy "quiz_questions: admins delete" on public.quiz_questions;
-- Отзыв на уровне таблицы снимает и выданные ранее права на отдельные колонки.
revoke insert, update, delete on table public.quiz_questions from anon, authenticated;
-- Чтение (только администратору, по RLS «quiz_questions: admins read») сохраняется.

-- 2. Общий шаг протокола: заблокировать тест, затем его вопросы ------------------------------------------

create function public.lock_quiz_for_write(p_quiz_id uuid)
returns public.quizzes
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_quiz public.quizzes;
begin
  select * into v_quiz from public.quizzes where id = p_quiz_id for update;
  if not found then
    raise exception 'quiz_not_found' using errcode = 'P0002';
  end if;
  perform 1 from public.quiz_questions where quiz_id = p_quiz_id order by id for update;
  return v_quiz;
end;
$$;

revoke all on function public.lock_quiz_for_write(uuid) from public, anon, authenticated;

-- 3. Изменение вопросов (только администратор) ------------------------------------------------------------

-- Новый вопрос в конец теста. Проверки (4 непустых варианта, правильный 0..3, текст) — ограничения таблицы.
create function public.admin_add_question(p_quiz_id uuid, p_text text, p_options text[], p_correct_index integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_question public.quiz_questions;
begin
  perform public.assert_admin();
  perform public.lock_quiz_for_write(p_quiz_id);
  insert into public.quiz_questions (quiz_id, position, text, options, correct_index)
  values (
    p_quiz_id,
    coalesce((select max(position) from public.quiz_questions where quiz_id = p_quiz_id), 0) + 1,
    btrim(p_text),
    p_options,
    p_correct_index
  )
  returning * into v_question;
  return to_jsonb(v_question);
end;
$$;

create function public.admin_update_question(p_question_id uuid, p_text text, p_options text[], p_correct_index integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_quiz_id uuid;
  v_question public.quiz_questions;
begin
  perform public.assert_admin();
  select quiz_id into v_quiz_id from public.quiz_questions where id = p_question_id;
  if not found then
    raise exception 'question_not_found' using errcode = 'P0002';
  end if;
  perform public.lock_quiz_for_write(v_quiz_id);
  -- Вопрос мог быть удалён, пока ждали блокировку.
  update public.quiz_questions
  set text = btrim(p_text), options = p_options, correct_index = p_correct_index
  where id = p_question_id and quiz_id = v_quiz_id
  returning * into v_question;
  if v_question.id is null then
    raise exception 'question_not_found' using errcode = 'P0002';
  end if;
  return to_jsonb(v_question);
end;
$$;

create function public.admin_delete_question(p_question_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_quiz_id uuid;
  v_deleted uuid;
begin
  perform public.assert_admin();
  select quiz_id into v_quiz_id from public.quiz_questions where id = p_question_id;
  if not found then
    raise exception 'question_not_found' using errcode = 'P0002';
  end if;
  perform public.lock_quiz_for_write(v_quiz_id);
  -- Правило «нельзя удалить последний вопрос опубликованного теста» проверяет триггер check_quiz_question_change().
  delete from public.quiz_questions where id = p_question_id and quiz_id = v_quiz_id returning id into v_deleted;
  if v_deleted is null then
    raise exception 'question_not_found' using errcode = 'P0002';
  end if;
  return jsonb_build_object('deleted', true);
end;
$$;

-- Перестановка: та же сигнатура, теперь по протоколу (тест → вопросы).
create or replace function public.admin_move_question(p_question_id uuid, p_direction integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_quiz_id uuid;
  v_q public.quiz_questions;
  v_n public.quiz_questions;
begin
  perform public.assert_admin();
  if p_direction not in (-1, 1) then
    raise exception 'invalid_direction' using errcode = '22023';
  end if;
  select quiz_id into v_quiz_id from public.quiz_questions where id = p_question_id;
  if not found then
    raise exception 'question_not_found' using errcode = 'P0002';
  end if;
  perform public.lock_quiz_for_write(v_quiz_id);
  select * into v_q from public.quiz_questions where id = p_question_id and quiz_id = v_quiz_id;
  if not found then
    raise exception 'question_not_found' using errcode = 'P0002';
  end if;
  -- Нормализация позиций 1..n (порядок прежний).
  with ordered as (
    select id, row_number() over (order by position, id) as rn from public.quiz_questions where quiz_id = v_quiz_id
  )
  update public.quiz_questions qq set position = o.rn from ordered o where qq.id = o.id and qq.position <> o.rn;
  select * into v_q from public.quiz_questions where id = p_question_id;
  select * into v_n from public.quiz_questions where quiz_id = v_quiz_id and position = v_q.position + p_direction;
  if not found then
    return jsonb_build_object('moved', false);
  end if;
  update public.quiz_questions set position = v_n.position where id = v_q.id;
  update public.quiz_questions set position = v_q.position where id = v_n.id;
  return jsonb_build_object('moved', true);
end;
$$;

revoke all on function public.admin_add_question(uuid, text, text[], integer) from public, anon;
revoke all on function public.admin_update_question(uuid, text, text[], integer) from public, anon;
revoke all on function public.admin_delete_question(uuid) from public, anon;
grant execute on function public.admin_add_question(uuid, text, text[], integer) to authenticated;
grant execute on function public.admin_update_question(uuid, text, text[], integer) to authenticated;
grant execute on function public.admin_delete_question(uuid) to authenticated;
-- admin_move_question: права из 20261120000000_quizzes.sql сохраняются (CREATE OR REPLACE не меняет ACL).
