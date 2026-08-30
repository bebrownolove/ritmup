alter table daily_logs
  add column if not exists steps integer check (steps between 0 and 200000);
alter table daily_logs
  add column if not exists exercise_minutes integer check (exercise_minutes between 0 and 1440);

-- Ключ для команды Apple Shortcuts: она шлёт данные Health без пароля и cookie.
create table if not exists health_tokens (
  token text primary key,
  user_id text not null references "user"("id") on delete cascade,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create unique index if not exists health_tokens_user_idx on health_tokens (user_id);
