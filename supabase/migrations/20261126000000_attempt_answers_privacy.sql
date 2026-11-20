-- DIGEX Campus — этап 3Б: закрыть ученикам ключи ответов в снимках попыток.
-- Зависит только от 20261120000000_quizzes.sql (таблица quiz_attempts). С миграциями 20261121…20261125 не пересекается:
-- её можно выполнить сразу после 20261120000000_quizzes.sql, не дожидаясь остальных.
--
-- Проблема: снимок попытки (answers) хранит по каждому вопросу правильный вариант (correct_index, is_correct).
-- Ученик читает свои попытки (RLS «quiz_attempts: read own»), а табличное право SELECT открывало и колонку answers:
-- после первой отправки ключ можно было прочитать через API и пройти тест повторно на 100%.
--
-- Решение: у клиентских ролей отозвано чтение всей таблицы; authenticated может читать только колонки истории
-- (без answers и служебного request_id). RLS по-прежнему ограничивает строки своими попытками (администратор — все).
-- Снимок ответов остаётся в базе без изменений; администратору он доступен через admin_attempt_answers().
-- Функции, работающие с попытками, ключей ученику не отдают: submit_quiz_attempt возвращает попытку без answers,
-- my_quiz_stats — только агрегаты, admin_quiz_results и admin_attempt_answers — только администратору.

revoke select on table public.quiz_attempts from anon, authenticated;
grant select (
  id, student_id, quiz_id, lesson_id, quiz_version, submitted_at,
  lesson_title, section_id, section_title, correct_count, total_count, percent
) on table public.quiz_attempts to authenticated;

-- Снимок ответов попытки — только администратору.
create function public.admin_attempt_answers(p_attempt_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_answers jsonb;
begin
  perform public.assert_admin();
  select answers into v_answers from public.quiz_attempts where id = p_attempt_id;
  if not found then
    raise exception 'attempt_not_found' using errcode = 'P0002';
  end if;
  return v_answers;
end;
$$;

revoke all on function public.admin_attempt_answers(uuid) from public, anon;
grant execute on function public.admin_attempt_answers(uuid) to authenticated;
