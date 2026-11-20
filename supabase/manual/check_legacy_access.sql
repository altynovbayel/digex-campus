-- DIGEX Campus: проверка перед миграцией 20261119000000_course_access.sql.
-- ТОЛЬКО ЧТЕНИЕ — ничего не изменяет. Выполните в Dashboard → SQL Editor и сообщите разработчику результат
-- (числа из первой таблицы; вторую — только если в ней есть строки).
--
-- Если old_payments = 0 — миграцию можно применять сразу (старая история пуста, переносить нечего).
-- Если old_payments > 0 — миграция остановится сама и ничего не изменит; нужно выбрать правило переноса.

-- 1. Сводка
select
  (select count(*) from public.profiles)                                          as profiles,
  (select count(*) from public.profiles where role = 'admin')                     as admins,
  (select count(*) from public.groups)                                            as sections,
  (select count(*) from public.lessons)                                           as lessons,
  (select count(*) from public.enrollments)                                       as old_enrollments,
  (select count(*) from public.payments)                                          as old_payments,
  (select count(*) from public.payments
     where revoked_at is null and access_starts_at <= now() and now() < access_ends_at) as old_active_periods,
  (select count(*) from (
     select e.student_id from public.payments p join public.enrollments e on e.id = p.enrollment_id
     where p.revoked_at is null and now() < p.access_ends_at
     group by e.student_id having count(*) > 1) t)                                 as students_with_several_active;

-- 2. Старые оплаты по ученикам (без email; id ученика достаточно для решения)
select
  e.student_id,
  e.group_id                      as section,
  p.amount_som,
  p.confirmed_at,
  p.access_starts_at,
  p.access_ends_at,
  p.revoked_at,
  case
    when p.revoked_at is not null then 'revoked'
    when now() < p.access_starts_at then 'not_started'
    when now() < p.access_ends_at then 'active'
    else 'expired'
  end                             as status
from public.payments p
join public.enrollments e on e.id = p.enrollment_id
order by e.student_id, p.access_starts_at;
