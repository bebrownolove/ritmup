import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { REPAIR_COST, balanceOf } from "@/lib/coins";
import { currentStreak, todayFor } from "@/lib/streak";

const schema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

/** Пропущенные дни за последние две недели — их можно выкупить за монеты. */
export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const result = await db.query<{ date: string }>(
    `select to_char(d.day,'YYYY-MM-DD') as date
       from generate_series(
              (now() at time zone coalesce((select timezone from profiles where user_id=$1),'UTC'))::date - 14,
              (now() at time zone coalesce((select timezone from profiles where user_id=$1),'UTC'))::date - 1,
              interval '1 day') as d(day)
      where not exists (select 1 from daily_logs l where l.user_id=$1 and l.log_date=d.day
                          and (l.calories_eaten > 0 or l.weight_kg is not null))
        and not exists (select 1 from workouts w where w.user_id=$1 and w.log_date=d.day)
        and not exists (select 1 from streak_repairs r where r.user_id=$1 and r.log_date=d.day)
      order by d.day desc`, [user.id]);
  return Response.json({ cost: REPAIR_COST, coins: await balanceOf(user.id), missed: result.rows.map(r => r.date) });
}

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_date" }, { status: 400 });
  const day = parsed.data.date;
  const today = await todayFor(user.id);
  if (day >= today) return Response.json({ error: "not_a_past_day" }, { status: 400 });

  // Списываем только при достаточном балансе — условие в самом UPDATE,
  // чтобы два одновременных запроса не увели баланс в минус.
  const paid = await db.query(
    `update profiles set coins = coins - $2 where user_id=$1 and coins >= $2 returning coins`,
    [user.id, REPAIR_COST]);
  if (!paid.rowCount) return Response.json({ error: "not_enough_coins", cost: REPAIR_COST }, { status: 402 });

  const saved = await db.query(
    `insert into streak_repairs (user_id, log_date) values ($1,$2)
     on conflict (user_id, log_date) do nothing`, [user.id, day]);
  if (!saved.rowCount) {
    await db.query(`update profiles set coins = coins + $2 where user_id=$1`, [user.id, REPAIR_COST]);
    return Response.json({ error: "already_repaired" }, { status: 409 });
  }
  await db.query(
    `insert into coin_events (user_id, event_key, amount, reason)
     values ($1,$2,$3,'repair') on conflict (user_id, event_key) do nothing`,
    [user.id, `repair:${day}`, -REPAIR_COST]);
  return Response.json({ ok: true, coins: await balanceOf(user.id), streak: await currentStreak(user.id) });
}
