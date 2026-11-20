-- DIGEX Campus — переход на единый доступ к курсу.
-- Применяется ПОСЛЕ 20261117000000_profiles.sql и 20261118000000_learning.sql (обе уже применены).
--
-- Было (этап 3А): ученик назначался в группу, оплата и 14 дней относились к одной группе.
-- Стало: Claude и ChatGPT — разделы ОДНОГО курса. Назначений нет. Одна подтверждённая оплата открывает
-- все разделы на общий период ровно 14 суток (336 часов) с момента активации администратором.
--
-- Сохраняются: profiles и роли, groups (разделы) и lessons с их id, старые таблицы enrollments и payments
-- (как архив — клиентам они больше недоступны). Новых 14 дней никому не назначается.
--
-- Если в старой таблице payments есть записи, миграция ОСТАНАВЛИВАЕТСЯ целиком (ничего не меняется):
-- правило переноса старых оплат выбирает владелец (см. supabase/manual/check_legacy_access.sql).
-- Выполняйте файл целиком одним запросом (SQL Editor выполняет его в одной транзакции).

-- 0. Защита: старые оплаты по разделам требуют явного решения о переносе ----------------------

do $$
declare
  v_payments bigint;
begin
  -- Блокируем запись в старые таблицы до конца транзакции миграции: выполняющиеся старые подтверждения
  -- дождутся фиксации, новые будут ждать. Подсчёт ниже видит все зафиксированные оплаты. Чтение не блокируется.
  lock table public.enrollments, public.payments in share row exclusive mode;
  select count(*) into v_payments from public.payments;
  if v_payments > 0 then
    raise exception
      'Найдено старых оплат по разделам: %. Миграция остановлена, изменений нет. Выполните supabase/manual/check_legacy_access.sql и выберите правило переноса.',
      v_payments;
  end if;
end;
$$;

-- Старые таблицы становятся архивом только для чтения — сразу, пока действует блокировка выше.
-- Триггер срабатывает для любой роли, включая владельца функций: даже вызов старой SECURITY DEFINER-функции,
-- начатый до миграции и продолжающийся после удаления функции, не сможет записать оплату или назначение.
create function public.reject_legacy_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'legacy_read_only: таблица % — архив модели доступа по разделам, запись запрещена', tg_table_name
    using errcode = '42501';
end;
$$;

revoke all on function public.reject_legacy_write() from public, anon, authenticated;

create trigger enrollments_read_only
  before insert or update or delete on public.enrollments
  for each row execute function public.reject_legacy_write();
create trigger payments_read_only
  before insert or update or delete on public.payments
  for each row execute function public.reject_legacy_write();

-- 1. Общий период доступа к курсу -------------------------------------------------------------

create table public.course_payments (
  id uuid primary key default gen_random_uuid(),
  -- restrict: история оплат не исчезает вместе с пользователем.
  student_id uuid not null references public.profiles (id) on delete restrict,
  -- Ключ идемпотентности от клиента: повтор того же запроса не создаёт вторую запись.
  request_id uuid not null constraint course_payments_request_unique unique,
  amount_som numeric(12, 2) not null
    constraint course_payments_amount_range check (amount_som > 0 and amount_som <= 10000000),
  confirmed_at timestamptz not null default now(),
  confirmed_by uuid references public.profiles (id) on delete set null,
  access_starts_at timestamptz not null,
  access_ends_at timestamptz not null,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id) on delete set null,
  revoke_reason text constraint course_payments_revoke_reason_length check (char_length(revoke_reason) <= 500),
  constraint course_payments_period_14_days check (access_ends_at = access_starts_at + interval '336 hours'),
  constraint course_payments_revoke_consistency check (revoked_at is not null or (revoked_by is null and revoke_reason is null))
);

create index course_payments_student_idx on public.course_payments (student_id, access_starts_at desc);

comment on table public.course_payments is
  'Подтверждённая оплата курса = общий период доступа ко всем разделам на 14 суток. Не удаляется; отзыв помечает revoked_at.';

alter table public.course_payments enable row level security;

create policy "course_payments: read own" on public.course_payments for select to authenticated
  using (student_id = (select auth.uid()));
create policy "course_payments: admins read" on public.course_payments for select to authenticated
  using ((select public.is_admin()));

revoke all on table public.course_payments from anon, authenticated;
grant select on table public.course_payments to authenticated;
-- INSERT/UPDATE/DELETE клиентским ролям не выдаются: запись — только функциями администратора ниже.

-- Доступ к курсу: период не отозван, начало наступило, серверное время строго меньше окончания.
create function public.has_course_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.course_payments p
    where p.student_id = (select auth.uid())
      and p.revoked_at is null
      and p.access_starts_at <= now()
      and now() < p.access_ends_at
  );
$$;

revoke all on function public.has_course_access() from public, anon;
grant execute on function public.has_course_access() to authenticated;

-- 2. Старая модель «доступ по разделу»: убираем все пути активации и чтения -----------------------

-- Политики, зависящие от старой функции и назначений.
drop policy "lessons: students read with access" on public.lessons;
drop policy "groups: students read own" on public.groups;

-- Старые функции (назначение, оплата и доступ по разделу) удаляются полностью.
drop function public.has_group_access(text);
drop function public.my_learning();
drop function public.my_payments();
drop function public.admin_assign_student(uuid, text);
drop function public.admin_confirm_payment(uuid, text, numeric, uuid);
drop function public.admin_revoke_access(uuid, text);
drop function public.admin_students_overview();

-- Старые таблицы остаются в базе как архив, но клиентам недоступны (ни чтения, ни записи).
drop policy "enrollments: read own" on public.enrollments;
drop policy "enrollments: admins read" on public.enrollments;
drop policy "payments: read own" on public.payments;
drop policy "payments: admins read" on public.payments;
revoke all on table public.enrollments, public.payments from anon, authenticated;
comment on table public.enrollments is 'УСТАРЕЛО (этап 3А): назначения по разделам. Не используется; клиентского доступа нет.';
comment on table public.payments is 'УСТАРЕЛО (этап 3А): оплаты по разделам. Не используется; клиентского доступа нет.';

-- 3. Разделы и уроки -------------------------------------------------------------------------------

-- Названия и описания активных разделов видит любой вошедший пользователь (безопасные метаданные).
create policy "groups: authenticated read active" on public.groups for select to authenticated
  using (archived_at is null);

-- Содержание уроков — только при действующем общем доступе: опубликованные, не архивные,
-- раздел не в архиве. Архив раздела скрывает только его материалы, общий доступ не меняется.
create policy "lessons: students read with course access" on public.lessons for select to authenticated
  using (
    published
    and archived_at is null
    and public.has_course_access()
    and exists (select 1 from public.groups g where g.id = lessons.group_id and g.archived_at is null)
  );

-- Разделы курса с числом опубликованных уроков — без содержания уроков (доступно и до оплаты).
create function public.course_sections()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', g.id,
      'title', g.title,
      'description', g.description,
      'lessons_count', (
        select count(*) from public.lessons l
        where l.group_id = g.id and l.published and l.archived_at is null
      )
    ) order by g.sort_order, g.title), '[]'::jsonb)
  from public.groups g
  where g.archived_at is null
    and (select auth.uid()) is not null;
$$;

revoke all on function public.course_sections() from public, anon;
grant execute on function public.course_sections() to authenticated;

-- 4. Функции ученика (SECURITY INVOKER — в рамках RLS) ----------------------------------------------

-- Общий статус доступа текущего пользователя по последнему периоду и серверному времени.
create function public.my_access()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'status', case
      when p.id is null then 'not_activated'
      when p.revoked_at is not null then 'revoked'
      when now() < p.access_starts_at then 'not_activated'
      when now() < p.access_ends_at then 'active'
      else 'expired'
    end,
    'access_starts_at', p.access_starts_at,
    'access_ends_at', p.access_ends_at,
    'revoked_at', p.revoked_at,
    'server_now', now()
  )
  from (select 1) one
  left join lateral (
    select * from public.course_payments cp
    where cp.student_id = (select auth.uid())
    order by cp.access_starts_at desc, cp.confirmed_at desc
    limit 1
  ) p on true;
$$;

-- История подтверждённых оплат текущего пользователя.
create function public.my_payments()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id,
      'amount_som', p.amount_som,
      'confirmed_at', p.confirmed_at,
      'access_starts_at', p.access_starts_at,
      'access_ends_at', p.access_ends_at,
      'revoked_at', p.revoked_at,
      'status', case
        when p.revoked_at is not null then 'revoked'
        when now() < p.access_starts_at then 'not_activated'
        when now() < p.access_ends_at then 'active'
        else 'expired'
      end
    ) order by p.confirmed_at desc), '[]'::jsonb)
  from public.course_payments p
  where p.student_id = (select auth.uid());
$$;

revoke all on function public.my_access() from public, anon;
revoke all on function public.my_payments() from public, anon;
grant execute on function public.my_access() to authenticated;
grant execute on function public.my_payments() to authenticated;

-- 5. Функции администратора (SECURITY DEFINER, явная проверка роли) ----------------------------------

-- Пользователи с email, общим статусом доступа и историей оплат.
create function public.admin_students_overview()
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
        'id', pr.id,
        'full_name', pr.full_name,
        'email', u.email,
        'role', pr.role,
        'created_at', pr.created_at,
        'payments', coalesce((
          select jsonb_agg(jsonb_build_object(
              'id', p.id,
              'amount_som', p.amount_som,
              'confirmed_at', p.confirmed_at,
              'access_starts_at', p.access_starts_at,
              'access_ends_at', p.access_ends_at,
              'revoked_at', p.revoked_at,
              'revoke_reason', p.revoke_reason,
              'status', case
                when p.revoked_at is not null then 'revoked'
                when now() < p.access_starts_at then 'not_activated'
                when now() < p.access_ends_at then 'active'
                else 'expired'
              end
            ) order by p.access_starts_at desc, p.confirmed_at desc)
          from public.course_payments p where p.student_id = pr.id
        ), '[]'::jsonb)
      ) order by pr.created_at desc), '[]'::jsonb)
    from public.profiles pr
    left join auth.users u on u.id = pr.id
  );
end;
$$;

-- Подтверждение оплаты курса и активация общего доступа — атомарно.
--  * Повтор с тем же p_request_id возвращает уже созданную оплату (replayed = true): без дубля и без сдвига дат.
--  * Пока действует текущий период, новая оплата отклоняется (access_already_active): продления нет.
--  * Начало — серверное now(), окончание — ровно через 14 суток.
create function public.admin_confirm_payment(p_student_id uuid, p_amount_som numeric, p_request_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_payment public.course_payments;
begin
  perform public.assert_admin();
  if p_request_id is null then
    raise exception 'request_id_required' using errcode = '22023';
  end if;
  if p_amount_som is null or p_amount_som <= 0 or p_amount_som > 10000000 or p_amount_som <> round(p_amount_som, 2) then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  -- Блокировка строки профиля: подтверждения для одного ученика выполняются строго по очереди.
  perform 1 from public.profiles where id = p_student_id for update;
  if not found then
    raise exception 'student_not_found' using errcode = 'P0002';
  end if;

  -- Повтор того же запроса (проверяется после блокировки).
  select * into v_payment from public.course_payments where request_id = p_request_id;
  if found then
    if v_payment.student_id <> p_student_id or v_payment.amount_som <> p_amount_som then
      raise exception 'request_id_conflict' using errcode = '22023';
    end if;
    return jsonb_build_object('payment', to_jsonb(v_payment), 'replayed', true);
  end if;

  if exists (
    select 1 from public.course_payments
    where student_id = p_student_id and revoked_at is null and now() < access_ends_at
  ) then
    raise exception 'access_already_active' using errcode = 'P0001';
  end if;

  insert into public.course_payments (
    student_id, request_id, amount_som, confirmed_by, access_starts_at, access_ends_at
  ) values (
    p_student_id, p_request_id, p_amount_som, (select auth.uid()), now(), now() + interval '336 hours'
  )
  returning * into v_payment;

  return jsonb_build_object('payment', to_jsonb(v_payment), 'replayed', false);
end;
$$;

-- Ручной отзыв действующего общего доступа. История сохраняется; повторный отзыв ничего не меняет.
create function public.admin_revoke_access(p_payment_id uuid, p_reason text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_payment public.course_payments;
begin
  perform public.assert_admin();
  select * into v_payment from public.course_payments where id = p_payment_id for update;
  if not found then
    raise exception 'payment_not_found' using errcode = 'P0002';
  end if;
  if v_payment.revoked_at is not null then
    return jsonb_build_object('payment', to_jsonb(v_payment), 'already_revoked', true);
  end if;
  if now() >= v_payment.access_ends_at then
    raise exception 'access_not_active' using errcode = 'P0001';
  end if;

  update public.course_payments
  set revoked_at = now(),
      revoked_by = (select auth.uid()),
      revoke_reason = nullif(left(btrim(coalesce(p_reason, '')), 500), '')
  where id = p_payment_id
  returning * into v_payment;

  return jsonb_build_object('payment', to_jsonb(v_payment), 'already_revoked', false);
end;
$$;

revoke all on function public.admin_students_overview() from public, anon;
revoke all on function public.admin_confirm_payment(uuid, numeric, uuid) from public, anon;
revoke all on function public.admin_revoke_access(uuid, text) from public, anon;
grant execute on function public.admin_students_overview() to authenticated;
grant execute on function public.admin_confirm_payment(uuid, numeric, uuid) to authenticated;
grant execute on function public.admin_revoke_access(uuid, text) to authenticated;
