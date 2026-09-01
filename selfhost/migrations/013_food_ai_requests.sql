-- Ограничиваем бесплатный анализ еды на уровне базы: перезапуск приложения
-- не обнуляет лимит и один пользователь не может исчерпать квоту для всех.
create table if not exists food_ai_requests (
  id bigint generated always as identity primary key,
  user_id text not null references "user"("id") on delete cascade,
  requested_at timestamptz not null default now()
);

create index if not exists food_ai_requests_user_requested_idx
  on food_ai_requests (user_id, requested_at desc);
