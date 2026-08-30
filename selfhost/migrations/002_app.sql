create table if not exists profiles (
  user_id text primary key references "user"("id") on delete cascade,
  bio varchar(160) not null default '',
  is_discoverable boolean not null default true,
  share_streak boolean not null default true,
  share_goal_hits boolean not null default true,
  share_workouts boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists daily_logs (
  id bigint generated always as identity primary key,
  user_id text not null references "user"("id") on delete cascade,
  log_date date not null,
  calories_eaten integer not null default 0 check (calories_eaten between 0 and 20000),
  active_calories integer not null default 0 check (active_calories between 0 and 20000),
  calorie_goal integer not null default 2000 check (calorie_goal between 500 and 10000),
  weight_kg numeric(5,2) check (weight_kg between 20 and 400),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, log_date)
);

create table if not exists food_entries (
  id uuid primary key,
  user_id text not null references "user"("id") on delete cascade,
  log_date date not null,
  title varchar(120) not null,
  meal varchar(24) not null,
  calories integer not null check (calories between 0 and 10000),
  created_at timestamptz not null default now()
);
create index if not exists food_entries_user_date_idx on food_entries (user_id, log_date);

create table if not exists friendships (
  requester_id text not null references "user"("id") on delete cascade,
  addressee_id text not null references "user"("id") on delete cascade,
  status varchar(16) not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);
create unique index if not exists friendships_pair_idx on friendships
  (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

create table if not exists activity_events (
  id bigint generated always as identity primary key,
  user_id text not null references "user"("id") on delete cascade,
  event_key varchar(80) not null,
  type varchar(32) not null check (type in ('streak','goal_hit','workout','milestone')),
  visibility varchar(16) not null default 'friends' check (visibility in ('private','friends','public')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, event_key)
);
create index if not exists activity_events_user_created_idx on activity_events (user_id, created_at desc);
