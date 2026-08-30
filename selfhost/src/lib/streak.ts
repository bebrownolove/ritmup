import { db } from "@/lib/db";

/** Сегодняшняя дата в часовом поясе пользователя, а не сервера. */
export async function todayFor(userId: string) {
  const result = await db.query<{ today: string }>(
    `select to_char((now() at time zone coalesce(timezone,'UTC'))::date,'YYYY-MM-DD') as today
       from profiles where user_id=$1`, [userId]);
  return result.rows[0]?.today
    ?? new Date().toISOString().slice(0, 10);
}

function shift(date: string, days: number) {
  const moment = new Date(`${date}T00:00:00Z`);
  moment.setUTCDate(moment.getUTCDate() + days);
  return moment.toISOString().slice(0, 10);
}

/**
 * Сколько дней подряд человек что-то отмечал: еду, вес, тренировку
 * или выкупленный за монеты день.
 * Серия жива, если последняя отметка была сегодня или вчера — иначе она прервалась.
 */
export async function currentStreak(userId: string) {
  const today = await todayFor(userId);
  const result = await db.query<{ day: string }>(
    `select day from (
        select to_char(log_date,'YYYY-MM-DD') as day from daily_logs
         where user_id=$1 and (calories_eaten > 0 or weight_kg is not null)
        union
        select to_char(log_date,'YYYY-MM-DD') from workouts where user_id=$1
        union
        select to_char(log_date,'YYYY-MM-DD') from streak_repairs where user_id=$1
      ) marked order by day desc limit 400`, [userId]);
  const days = new Set(result.rows.map(row => row.day));
  let cursor = days.has(today) ? today : shift(today, -1);
  if (!days.has(cursor)) return 0;
  let streak = 0;
  while (days.has(cursor)) { streak += 1; cursor = shift(cursor, -1); }
  return streak;
}

/** Событие серии в ленте друзей — только если человек разрешил её показывать. */
export async function publishStreak(userId: string, day: string, streak: number) {
  if (streak <= 0) return;
  await db.query(
    `insert into activity_events (user_id, event_key, type, visibility, payload)
     select $1,$2,'streak','friends',jsonb_build_object('days',$3::int)
      where exists(select 1 from profiles where user_id=$1 and share_streak=true)
     on conflict(user_id,event_key) do update set payload=excluded.payload`,
    [userId, `streak:${day}`, streak]);
}
