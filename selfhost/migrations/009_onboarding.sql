alter table profiles
  add column if not exists onboarding_completed boolean not null default false;

-- Не заставляем уже настроенных пользователей проходить первый запуск заново.
update profiles
   set onboarding_completed = true
 where height_cm is not null
   and sex is not null
   and birth_year is not null;
