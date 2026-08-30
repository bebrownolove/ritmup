-- Личная дневная норма калорий. Раньше 2000 было зашито в коде,
-- хотя у разных людей норма разная.
alter table profiles
  add column if not exists calorie_goal integer not null default 2000
  check (calorie_goal between 500 and 10000);
