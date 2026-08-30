-- Тренировки: пользователь записывает их руками, отдельно от данных Apple Health.
create table if not exists workouts (
  id uuid primary key,
  user_id text not null references "user"("id") on delete cascade,
  log_date date not null,
  title varchar(80) not null,
  minutes integer not null check (minutes between 1 and 1440),
  calories integer check (calories between 0 and 10000),
  created_at timestamptz not null default now()
);
create index if not exists workouts_user_date_idx on workouts (user_id, log_date desc);
