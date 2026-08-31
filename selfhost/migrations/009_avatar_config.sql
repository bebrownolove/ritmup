alter table profiles
  add column if not exists avatar_config jsonb not null default '{"skin":"warm","head":"round","hair":"fringe","hairColor":"espresso","eyes":"bright","mouth":"smile","outfit":"hoodie","headwear":"none","glasses":"none","piercing":"stud","tattoo":"none","accessory":"none","background":"mint"}'::jsonb;
