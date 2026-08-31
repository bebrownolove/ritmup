alter table profiles
  add column if not exists share_food boolean not null default false;
