-- DIGEX Campus: выдача роли администратора ОДНОМУ конкретному аккаунту.
-- НЕ миграция. Выполняется вручную в Supabase Dashboard → SQL Editor
-- после того, как вы зарегистрировались и подтвердили email.
--
-- 1. Замените адрес в строке ниже на email своего аккаунта.
-- 2. Выполните скрипт. Должна обновиться ровно 1 строка.

update public.profiles
set role = 'admin'
where id = (
  select id from auth.users
  where email = lower('ВАШ_EMAIL@example.com')
)
returning id, full_name, role;

-- Проверка:
-- select p.full_name, u.email, p.role from public.profiles p join auth.users u on u.id = p.id;

-- Отозвать роль:
-- update public.profiles set role = 'student'
-- where id = (select id from auth.users where email = lower('ВАШ_EMAIL@example.com'));
