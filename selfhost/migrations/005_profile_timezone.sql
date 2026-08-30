-- Часовой пояс пользователя. Нужен, чтобы команда с iPhone могла не присылать дату:
-- сервер сам считает, какой «сегодня» у этого человека.
alter table profiles
  add column if not exists timezone text;
