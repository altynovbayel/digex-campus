-- DIGEX Campus — этап 2: профили пользователей, связанные с Supabase Auth.

-- 1. Таблица профилей ---------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null
    constraint profiles_full_name_length check (char_length(btrim(full_name)) between 1 and 100),
  role text not null default 'student'
    constraint profiles_role_check check (role in ('student', 'admin')),
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'Профиль пользователя DIGEX Campus (1:1 с auth.users).';
comment on column public.profiles.role is 'student | admin. Меняется только вручную через SQL администратором БД.';

alter table public.profiles enable row level security;

-- 2. Права на уровне таблицы и колонок ---------------------------------------
-- Убираем права по умолчанию и выдаём только необходимое.
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
-- Пользователь может изменить ТОЛЬКО имя. Колонки role, id, created_at недоступны для UPDATE.
grant update (full_name) on table public.profiles to authenticated;
-- INSERT/DELETE клиенту не нужны: профиль создаёт триггер, удаляется каскадом вместе с пользователем.

-- 3. Проверка роли администратора (security definer — без рекурсии в RLS) ---
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- 4. Политики RLS ------------------------------------------------------------
create policy "profiles: read own"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profiles: admins read all"
  on public.profiles for select
  to authenticated
  using ((select public.is_admin()));

create policy "profiles: update own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- 5. Защита от смены роли и id (вторая линия обороны поверх прав на колонки) --
create function public.profiles_guard_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id or new.created_at is distinct from old.created_at then
    raise exception 'Нельзя изменить id или дату создания профиля';
  end if;
  -- Роль можно изменить только напрямую в БД (SQL Editor / миграция), не через API.
  if new.role is distinct from old.role and current_user in ('authenticated', 'anon') then
    raise exception 'Изменение роли запрещено';
  end if;
  new.full_name := btrim(new.full_name);
  return new;
end;
$$;

create trigger profiles_guard_immutable
  before update on public.profiles
  for each row execute function public.profiles_guard_immutable();

-- 6. Автоматическое создание профиля при регистрации ---------------------------
-- Роль ВСЕГДА student: значение role из метаданных регистрации игнорируется,
-- первый зарегистрированный пользователь администратором не становится.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := left(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 100);
begin
  if v_name = '' then
    v_name := 'Ученик';
  end if;

  insert into public.profiles (id, full_name, role)
  values (new.id, v_name, 'student');

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
