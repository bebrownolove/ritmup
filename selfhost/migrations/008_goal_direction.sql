alter table profiles
  add column if not exists goal_direction varchar(8)
  check (goal_direction in ('lose', 'keep', 'gain'));
