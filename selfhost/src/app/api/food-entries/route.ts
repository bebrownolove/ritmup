import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { currentStreak, publishStreak } from "@/lib/streak";
import { awardDay } from "@/lib/coins";

/**
 * Сводка дня — производная от самих записей, поэтому пересчитываем её здесь же.
 * Раньше её присылал браузер отдельным запросом, и один сбой оставлял день пустым.
 */
async function recalculate(userId: string, date: string) {
  await db.query(`insert into profiles(user_id) values($1) on conflict(user_id) do nothing`, [userId]);
  await db.query(
    `insert into daily_logs (user_id, log_date, calories_eaten, calorie_goal)
     select $1,$2,coalesce((select sum(calories) from food_entries where user_id=$1 and log_date=$2),0),
            coalesce((select calorie_goal from profiles where user_id=$1),2000)
     on conflict (user_id, log_date) do update
        set calories_eaten=coalesce((select sum(calories) from food_entries where user_id=$1 and log_date=$2),0),
            updated_at=now()`, [userId, date]);
}

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const createSchema = z.object({
  date: dateSchema,
  title: z.string().trim().min(1).max(120),
  calories: z.coerce.number().min(0).max(10000).transform(v => Math.round(v)),
});

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const parsed = dateSchema.safeParse(new URL(request.url).searchParams.get("date"));
  if (!parsed.success) return Response.json({ error: "invalid_date" }, { status: 400 });
  const result = await db.query(
    `select id, title, calories from food_entries
      where user_id=$1 and log_date=$2 order by created_at`, [user.id, parsed.data]);
  return Response.json(result.rows);
}

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_entry" }, { status: 400 });
  const entry = parsed.data;
  const id = randomUUID();
  await db.query(
    `insert into food_entries (id, user_id, log_date, title, meal, calories)
     values ($1,$2,$3,$4,'other',$5)`, [id, user.id, entry.date, entry.title, entry.calories]);
  await recalculate(user.id, entry.date);
  await awardDay(user.id, entry.date);
  await publishStreak(user.id, entry.date, await currentStreak(user.id));
  return Response.json({ id, title: entry.title, calories: entry.calories });
}

/** Удаляем только свою запись: чужой id ничего не тронет. */
export async function DELETE(request: Request) {
  const user = await requireUser(request);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !z.string().uuid().safeParse(id).success)
    return Response.json({ error: "invalid_id" }, { status: 400 });
  const result = await db.query<{ date: string }>(
    `delete from food_entries where id=$1 and user_id=$2
      returning to_char(log_date,'YYYY-MM-DD') as date`, [id, user.id]);
  const day = result.rows[0]?.date;
  if (day) await recalculate(user.id, day);
  return Response.json({ ok: true, deleted: result.rowCount ?? 0 });
}
