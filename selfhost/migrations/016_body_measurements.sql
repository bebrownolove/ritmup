-- Замеры тела: талия, живот, бёдра, бедро, рука, грудь. Отдельная от
-- daily_logs таблица — эти цифры записывают раз в 1-2 недели, а не каждый
-- день, и колонки все опциональны: человек может занести только то, что
-- измерил в этот раз.
create table if not exists body_measurements (
  user_id text not null references "user"("id") on delete cascade,
  log_date date not null,
  waist_cm numeric(5,1) check (waist_cm between 30 and 250),
  belly_cm numeric(5,1) check (belly_cm between 30 and 250),
  hips_cm numeric(5,1) check (hips_cm between 30 and 250),
  thigh_cm numeric(5,1) check (thigh_cm between 15 and 150),
  arm_cm numeric(5,1) check (arm_cm between 10 and 100),
  chest_cm numeric(5,1) check (chest_cm between 30 and 250),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, log_date)
);
create index if not exists body_measurements_user_date_idx on body_measurements (user_id, log_date desc);
