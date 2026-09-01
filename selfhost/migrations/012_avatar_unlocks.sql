-- Купленные за монеты детали внешности. Массив ключей вида 'outfit:armor';
-- покупка навсегда, поэтому список только пополняется.
alter table profiles
  add column if not exists avatar_unlocked text[] not null default '{}'::text[];

-- Пол персонажа появился позже остальных категорий: у существующих профилей
-- его в jsonb нет, и normalizeAvatar() подставил бы "girl" всем подряд.
-- Мальчик — там, где выбрана мужская причёска, остальным девочка.
update profiles
   set avatar_config = avatar_config || jsonb_build_object('sex',
         case when avatar_config->>'hair' in ('short','fringe','mohawk','shaved') then 'boy' else 'girl' end)
 where avatar_config->>'sex' is null;

alter table profiles
  alter column avatar_config set default
    '{"sex":"girl","skin":"warm","head":"round","hair":"fringe","hairColor":"espresso","eyes":"bright","mouth":"smile","outfit":"hoodie","headwear":"none","glasses":"none","piercing":"stud","tattoo":"none","accessory":"none","background":"mint"}'::jsonb;
