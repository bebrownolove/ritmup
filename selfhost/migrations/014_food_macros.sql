-- Белки, жиры и углеводы записи. Граммы дробные: 12.4 г белка честнее, чем 12.
-- Пусто там, где запись добавлена руками и БЖУ никто не считал.
alter table food_entries
  add column if not exists protein_g numeric(6,1) check (protein_g >= 0 and protein_g <= 2000),
  add column if not exists fat_g numeric(6,1) check (fat_g >= 0 and fat_g <= 2000),
  add column if not exists carbs_g numeric(6,1) check (carbs_g >= 0 and carbs_g <= 2000);

-- Дневные суммы держим рядом с калориями, чтобы экран дня и карточка друга
-- не пересчитывали их из записей на каждый запрос.
alter table daily_logs
  add column if not exists protein_g numeric(7,1) not null default 0,
  add column if not exists fat_g numeric(7,1) not null default 0,
  add column if not exists carbs_g numeric(7,1) not null default 0;
