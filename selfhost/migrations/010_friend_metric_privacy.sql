alter table profiles
  add column if not exists share_weight boolean not null default false,
  add column if not exists share_calories boolean not null default false,
  add column if not exists share_steps boolean not null default false;
