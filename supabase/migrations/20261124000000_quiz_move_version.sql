-- DIGEX Campus — этап 3Б: перестановка вопроса с проверкой версии теста.
-- Применяется ПОСЛЕ 20261123000000_quiz_concurrency.sql. Предыдущие миграции не меняются.
--
-- Проблема: если ответ на перестановку потерян (тайм-аут), а запись в базе завершилась позже перечитывания,
-- редактор показывал старый порядок и повторное нажатие сдвигало вопрос ещё раз.
-- Решение: admin_move_question принимает ожидаемую версию теста (из загруженного редактором состояния)
-- и сверяет её под блокировкой теста (тест → вопросы, как во всех функциях записи). При расхождении — ошибка
-- quiz_version_conflict без изменений. Старая сигнатура без версии удаляется, чтобы её нельзя было вызвать через API.

drop function public.admin_move_question(uuid, integer);

create function public.admin_move_question(p_question_id uuid, p_direction integer, p_expected_version integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_quiz_id uuid;
  v_quiz public.quizzes;
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
  v_quiz := public.lock_quiz_for_write(v_quiz_id);
  -- Перестановка «выше/ниже» имеет смысл только относительно порядка, который видит администратор.
  -- Версия сверяется под блокировкой теста: если тест изменился (в том числе прежней перестановкой,
  -- ответ на которую потерялся), порядок не трогаем — клиент перечитает тест.
  if p_expected_version is null or v_quiz.version <> p_expected_version then
    raise exception 'quiz_version_conflict' using errcode = 'P0001';
  end if;
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

revoke all on function public.admin_move_question(uuid, integer, integer) from public, anon;
grant execute on function public.admin_move_question(uuid, integer, integer) to authenticated;
