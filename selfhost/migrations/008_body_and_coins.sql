-- Данные тела для ИМТ и расчёта нормы калорий.
alter table profiles add column if not exists height_cm integer check (height_cm between 100 and 250);
alter table profiles add column if not exists sex varchar(8) check (sex in ('male','female'));
alter table profiles add column if not exists birth_year integer check (birth_year between 1900 and 2100);
alter table profiles add column if not exists activity_level varchar(16) not null default 'light'
  check (activity_level in ('low','light','medium','high','athlete'));
alter table profiles add column if not exists target_weight_kg numeric(5,2) check (target_weight_kg between 20 and 400);

-- Монеты за серии и покупка возврата пропущенного дня.
alter table profiles add column if not exists coins integer not null default 0 check (coins >= 0);

create table if not exists coin_events (
  id bigint generated always as identity primary key,
  user_id text not null references "user"("id") on delete cascade,
  event_key varchar(80) not null,
  amount integer not null,
  reason varchar(32) not null,
  created_at timestamptz not null default now(),
  unique (user_id, event_key)
);
create index if not exists coin_events_user_idx on coin_events (user_id, created_at desc);

-- Выкупленные дни: серия считает их так же, как настоящие отметки.
create table if not exists streak_repairs (
  user_id text not null references "user"("id") on delete cascade,
  log_date date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, log_date)
);
