-- DIGEX Campus — этап 3А: группы, уроки, назначения, подтверждённые оплаты и доступ на 14 суток.
-- Применяется ПОСЛЕ 20261117000000_profiles.sql (использует public.profiles и public.is_admin()).
--
-- Модель:
--   groups       — направления (стабильные текстовые id: claude, chatgpt);
--   lessons      — уроки группы, черновик/опубликован, архив вместо удаления;
--   enrollments  — назначение ученика в группу (одно на пару ученик–группа);
--   payments     — подтверждённая администратором оплата = период доступа ровно 14 суток (336 часов).
--                  Отзыв помечает период (revoked_at), история не удаляется.
-- Доступ к урокам проверяется RLS по серверному времени при каждом запросе —
-- по окончании срока материалы закрываются автоматически, без cron.

-- 1. Таблицы --------------------------------------------------------------------

create table public.groups (
  id text primary key
    constraint groups_id_format check (id ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  title text not null
    constraint groups_title_length check (char_length(btrim(title)) between 1 and 100),
  description text not null default ''
    constraint groups_description_length check (char_length(description) <= 500),
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lessons (
  id text primary key default gen_random_uuid()::text
    constraint lessons_id_format check (id ~ '^[A-Za-z0-9_-]{1,64}$'),
  group_id text not null references public.groups (id) on delete restrict,
  title text not null
    constraint lessons_title_length check (char_length(btrim(title)) between 1 and 200),
  position integer not null default 1
    constraint lessons_position_range check (position between 1 and 10000),
  goal text not null default '' constraint lessons_goal_length check (char_length(goal) <= 1000),
  content text not null default '' constraint lessons_content_length check (char_length(content) <= 50000),
  example_prompt text not null default '' constraint lessons_prompt_length check (char_length(example_prompt) <= 5000),
  task text not null default '' constraint lessons_task_length check (char_length(task) <= 5000),
  -- Только ссылки YouTube; null — «Видео скоро появится».
  youtube_url text
    constraint lessons_youtube_url check (
      youtube_url is null
      or (char_length(youtube_url) <= 300
          and youtube_url ~ '^https://(www\.|m\.)?(youtube\.com/(watch\?v=|embed/|shorts/|live/)|youtu\.be/)[A-Za-z0-9_-]{11}')
    ),
  published boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lessons_group_position_idx on public.lessons (group_id, position);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  group_id text not null references public.groups (id) on delete restrict,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  constraint enrollments_student_group_unique unique (student_id, group_id)
);

create index enrollments_group_idx on public.enrollments (group_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  -- restrict: история оплат не исчезает вместе с назначением.
  enrollment_id uuid not null references public.enrollments (id) on delete restrict,
  -- Ключ идемпотентности от клиента: повтор того же запроса не создаёт вторую запись.
  request_id uuid not null constraint payments_request_unique unique,
  amount_som numeric(12, 2) not null
    constraint payments_amount_range check (amount_som > 0 and amount_som <= 10000000),
  confirmed_at timestamptz not null default now(),
  confirmed_by uuid references public.profiles (id) on delete set null,
  access_starts_at timestamptz not null,
  access_ends_at timestamptz not null,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id) on delete set null,
  revoke_reason text constraint payments_revoke_reason_length check (char_length(revoke_reason) <= 500),
  -- Ровно 14 суток, независимо от часового пояса сессии.
  constraint payments_period_14_days check (access_ends_at = access_starts_at + interval '336 hours'),
  -- Без отзыва не может быть отозвавшего (revoked_by может стать null, если профиль администратора удалён).
  constraint payments_revoke_consistency check (revoked_at is not null or (revoked_by is null and revoke_reason is null))
);

create index payments_enrollment_idx on public.payments (enrollment_id, access_starts_at desc);

comment on table public.payments is
  'Подтверждённая администратором оплата = период доступа 14 суток. Не удаляется; отзыв помечает revoked_at.';

-- 2. updated_at ------------------------------------------------------------------

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger groups_touch_updated_at before update on public.groups
  for each row execute function public.touch_updated_at();
create trigger lessons_touch_updated_at before update on public.lessons
  for each row execute function public.touch_updated_at();

-- 3. Проверка доступа (используется в RLS) ----------------------------------------
-- Доступ есть, только если: назначение принадлежит текущему пользователю, группа не в архиве,
-- период не отозван, начало наступило и серверное время строго меньше окончания.

create function public.has_group_access(p_group_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.enrollments e
    join public.groups g on g.id = e.group_id
    join public.payments p on p.enrollment_id = e.id
    where e.student_id = (select auth.uid())
      and e.group_id = p_group_id
      and g.archived_at is null
      and p.revoked_at is null
      and p.access_starts_at <= now()
      and now() < p.access_ends_at
  );
$$;

-- 4. RLS -------------------------------------------------------------------------

alter table public.groups enable row level security;
alter table public.lessons enable row level security;
alter table public.enrollments enable row level security;
alter table public.payments enable row level security;

-- groups: администратор — всё; ученик — только группы своих назначений.
create policy "groups: admins read" on public.groups for select to authenticated
  using ((select public.is_admin()));
create policy "groups: students read own" on public.groups for select to authenticated
  using (exists (
    select 1 from public.enrollments e
    where e.group_id = groups.id and e.student_id = (select auth.uid())
  ));
create policy "groups: admins insert" on public.groups for insert to authenticated
  with check ((select public.is_admin()));
create policy "groups: admins update" on public.groups for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- lessons: администратор — всё, включая черновики и архив;
-- ученик — только опубликованные, не архивные уроки группы с активным доступом.
create policy "lessons: admins read" on public.lessons for select to authenticated
  using ((select public.is_admin()));
create policy "lessons: students read with access" on public.lessons for select to authenticated
  using (published and archived_at is null and public.has_group_access(group_id));
create policy "lessons: admins insert" on public.lessons for insert to authenticated
  with check ((select public.is_admin()));
create policy "lessons: admins update" on public.lessons for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- enrollments и payments: чтение своих или всех для администратора. Запись — только через функции ниже.
create policy "enrollments: read own" on public.enrollments for select to authenticated
  using (student_id = (select auth.uid()));
create policy "enrollments: admins read" on public.enrollments for select to authenticated
  using ((select public.is_admin()));

create policy "payments: read own" on public.payments for select to authenticated
  using (exists (
    select 1 from public.enrollments e
    where e.id = payments.enrollment_id and e.student_id = (select auth.uid())
  ));
create policy "payments: admins read" on public.payments for select to authenticated
  using ((select public.is_admin()));

-- 5. Права (Automatically expose new tables выключен — выдаём явно) ------------------

revoke all on table public.groups, public.lessons, public.enrollments, public.payments from anon, authenticated;

grant select on table public.groups, public.lessons, public.enrollments, public.payments to authenticated;

-- Запись в groups/lessons разрешена правами только на перечисленные колонки; RLS пропускает лишь администратора.
grant insert (id, title, description, sort_order) on table public.groups to authenticated;
grant update (title, description, sort_order, archived_at) on table public.groups to authenticated;
grant insert (group_id, title, position, goal, content, example_prompt, task, youtube_url, published)
  on table public.lessons to authenticated;
grant update (title, position, goal, content, example_prompt, task, youtube_url, published, archived_at)
  on table public.lessons to authenticated;
-- DELETE не выдаётся никому из клиентских ролей: только архивирование.
-- enrollments и payments: INSERT/UPDATE/DELETE клиентским ролям не выдаются.

revoke all on function public.has_group_access(text) from public, anon;
grant execute on function public.has_group_access(text) to authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;

-- 6. Функции ученика (SECURITY INVOKER: работают в рамках RLS) ----------------------

-- Назначения текущего пользователя со статусом доступа по серверному времени.
create function public.my_learning()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(row_data order by sort_order, group_title), '[]'::jsonb)
  from (
    select
      g.sort_order,
      g.title as group_title,
      jsonb_build_object(
        'enrollment_id', e.id,
        'group_id', g.id,
        'group_title', g.title,
        'group_description', g.description,
        'group_archived', g.archived_at is not null,
        'status', case
          when g.archived_at is not null then 'archived'
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
      ) as row_data
    from public.enrollments e
    join public.groups g on g.id = e.group_id
    left join lateral (
      select * from public.payments pp
      where pp.enrollment_id = e.id
      order by pp.access_starts_at desc, pp.confirmed_at desc
      limit 1
    ) p on true
    where e.student_id = (select auth.uid())
  ) t;
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
      'group_id', g.id,
      'group_title', g.title,
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
  from public.payments p
  join public.enrollments e on e.id = p.enrollment_id
  join public.groups g on g.id = e.group_id
  where e.student_id = (select auth.uid());
$$;

revoke all on function public.my_learning() from public, anon;
revoke all on function public.my_payments() from public, anon;
grant execute on function public.my_learning() to authenticated;
grant execute on function public.my_payments() to authenticated;

-- 7. Функции администратора (SECURITY DEFINER, явная проверка роли) ------------------

create function public.assert_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'admin_required' using errcode = '42501';
  end if;
end;
$$;

-- Ученики с email, назначениями, текущим статусом и историей оплат.
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
        'enrollments', coalesce((
          select jsonb_agg(jsonb_build_object(
              'enrollment_id', e.id,
              'group_id', g.id,
              'group_title', g.title,
              'group_archived', g.archived_at is not null,
              'assigned_at', e.created_at,
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
                  ) order by p.access_starts_at desc)
                from public.payments p where p.enrollment_id = e.id
              ), '[]'::jsonb)
            ) order by g.sort_order, g.title)
          from public.enrollments e
          join public.groups g on g.id = e.group_id
          where e.student_id = pr.id
        ), '[]'::jsonb)
      ) order by pr.created_at desc), '[]'::jsonb)
    from public.profiles pr
    left join auth.users u on u.id = pr.id
  );
end;
$$;

-- Назначение ученика в группу. Повторный вызов возвращает существующее назначение.
create function public.admin_assign_student(p_student_id uuid, p_group_id text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_enrollment public.enrollments;
begin
  perform public.assert_admin();
  if not exists (select 1 from public.profiles where id = p_student_id) then
    raise exception 'student_not_found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.groups where id = p_group_id and archived_at is null) then
    raise exception 'group_not_found' using errcode = 'P0002';
  end if;

  insert into public.enrollments (student_id, group_id, created_by)
  values (p_student_id, p_group_id, (select auth.uid()))
  on conflict (student_id, group_id) do nothing;

  select * into v_enrollment from public.enrollments
  where student_id = p_student_id and group_id = p_group_id;
  return to_jsonb(v_enrollment);
end;
$$;

-- Подтверждение оплаты и активация доступа — атомарно.
--  * Повтор с тем же p_request_id возвращает уже созданную оплату (replayed = true):
--    без дубля и без сдвига дат.
--  * Пока есть действующий период, новая оплата отклоняется (access_already_active):
--    автоматического продления нет.
--  * Начало — серверное now(), окончание — ровно через 14 суток.
create function public.admin_confirm_payment(
  p_student_id uuid,
  p_group_id text,
  p_amount_som numeric,
  p_request_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_enrollment public.enrollments;
  v_payment public.payments;
begin
  perform public.assert_admin();
  if p_request_id is null then
    raise exception 'request_id_required' using errcode = '22023';
  end if;
  if p_amount_som is null or p_amount_som <= 0 or p_amount_som > 10000000 or p_amount_som <> round(p_amount_som, 2) then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_student_id) then
    raise exception 'student_not_found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.groups where id = p_group_id and archived_at is null) then
    raise exception 'group_not_found' using errcode = 'P0002';
  end if;

  -- Назначение создаётся при необходимости и блокируется: параллельные подтверждения
  -- для одной пары ученик–группа выполняются строго по очереди.
  insert into public.enrollments (student_id, group_id, created_by)
  values (p_student_id, p_group_id, (select auth.uid()))
  on conflict (student_id, group_id) do nothing;

  select * into v_enrollment from public.enrollments
  where student_id = p_student_id and group_id = p_group_id
  for update;

  -- Повтор того же запроса (проверяется после блокировки).
  select * into v_payment from public.payments where request_id = p_request_id;
  if found then
    if v_payment.enrollment_id <> v_enrollment.id or v_payment.amount_som <> p_amount_som then
      raise exception 'request_id_conflict' using errcode = '22023';
    end if;
    return jsonb_build_object('payment', to_jsonb(v_payment), 'replayed', true);
  end if;

  if exists (
    select 1 from public.payments
    where enrollment_id = v_enrollment.id and revoked_at is null and now() < access_ends_at
  ) then
    raise exception 'access_already_active' using errcode = 'P0001';
  end if;

  insert into public.payments (
    enrollment_id, request_id, amount_som, confirmed_by, access_starts_at, access_ends_at
  ) values (
    v_enrollment.id, p_request_id, p_amount_som, (select auth.uid()), now(), now() + interval '336 hours'
  )
  returning * into v_payment;

  return jsonb_build_object('payment', to_jsonb(v_payment), 'replayed', false);
end;
$$;

-- Ручной отзыв действующего доступа. История сохраняется; повторный отзыв ничего не меняет.
create function public.admin_revoke_access(p_payment_id uuid, p_reason text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_payment public.payments;
begin
  perform public.assert_admin();
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'payment_not_found' using errcode = 'P0002';
  end if;
  if v_payment.revoked_at is not null then
    return jsonb_build_object('payment', to_jsonb(v_payment), 'already_revoked', true);
  end if;
  if now() >= v_payment.access_ends_at then
    raise exception 'access_not_active' using errcode = 'P0001';
  end if;

  update public.payments
  set revoked_at = now(),
      revoked_by = (select auth.uid()),
      revoke_reason = nullif(left(btrim(coalesce(p_reason, '')), 500), '')
  where id = p_payment_id
  returning * into v_payment;

  return jsonb_build_object('payment', to_jsonb(v_payment), 'already_revoked', false);
end;
$$;

-- Перемещение урока на одну позицию вверх (-1) или вниз (+1) внутри группы — атомарный обмен позициями.
create function public.admin_move_lesson(p_lesson_id text, p_direction integer)
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

  -- Блокируем уроки группы, чтобы параллельные перемещения не перемешали порядок,
  -- и нормализуем позиции активных уроков в 1..n (порядок прежний).
  perform 1 from public.lessons where group_id = v_lesson.group_id for update;
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

revoke all on function public.assert_admin() from public, anon, authenticated;
revoke all on function public.admin_students_overview() from public, anon;
revoke all on function public.admin_assign_student(uuid, text) from public, anon;
revoke all on function public.admin_confirm_payment(uuid, text, numeric, uuid) from public, anon;
revoke all on function public.admin_revoke_access(uuid, text) from public, anon;
revoke all on function public.admin_move_lesson(text, integer) from public, anon;
grant execute on function public.admin_students_overview() to authenticated;
grant execute on function public.admin_assign_student(uuid, text) to authenticated;
grant execute on function public.admin_confirm_payment(uuid, text, numeric, uuid) to authenticated;
grant execute on function public.admin_revoke_access(uuid, text) to authenticated;
grant execute on function public.admin_move_lesson(text, integer) to authenticated;
