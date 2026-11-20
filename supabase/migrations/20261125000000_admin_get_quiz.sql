-- DIGEX Campus — этап 3Б: согласованная загрузка теста в редактор администратора.
-- Применяется ПОСЛЕ 20261124000000_quiz_move_version.sql. Предыдущие миграции не меняются.
--
-- Проблема: редактор читал версию теста и вопросы двумя запросами. Если между ними фиксировалась перестановка,
-- на экране оказывался новый порядок со старой версией, и следующая перестановка отклонялась как конфликт.
-- Решение: admin_get_quiz() возвращает тест, версию и вопросы ОДНИМ оператором SELECT — из одного снимка данных,
-- поэтому версия всегда соответствует показанному порядку. Проверка версии в admin_move_question сохраняется.
-- Доступ: только администратор (assert_admin), как и прямое чтение таблиц по RLS; ученику функция недоступна,
-- правильные ответы ему по-прежнему не выдаются. Функция только читает: блокировок не берёт.

create function public.admin_get_quiz(p_lesson_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform public.assert_admin();
  -- Один оператор: тест и его вопросы читаются из одного снимка.
  select jsonb_build_object(
    'quiz',
    (
      select jsonb_build_object(
        'id', q.id,
        'published', q.published,
        'version', q.version,
        'questions', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', qq.id,
                'position', qq.position,
                'text', qq.text,
                'options', to_jsonb(qq.options),
                'correct_index', qq.correct_index
              )
              order by qq.position, qq.id
            )
            from public.quiz_questions qq
            where qq.quiz_id = q.id
          ),
          '[]'::jsonb
        )
      )
      from public.quizzes q
      where q.lesson_id = p_lesson_id
    )
  )
  into v_result;
  return v_result;
end;
$$;

revoke all on function public.admin_get_quiz(text) from public, anon;
grant execute on function public.admin_get_quiz(text) to authenticated;
