import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const createSchema = z.object({
  date: dateSchema,
  title: z.string().trim().min(1).max(80),
  minutes: z.coerce.number().min(1).max(1440).transform(v => Math.round(v)),
  calories: z.coerce.number().min(0).max(10000).nullish().transform(v => v == null ? null : Math.round(v)),
});

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  // Без даты отдаём недавние тренировки — для истории на экране.
  if (date) {
    const parsed = dateSchema.safeParse(date);
    if (!parsed.success) return Response.json({ error: "invalid_date" }, { status: 400 });
    const result = await db.query(
      `select id, title, minutes, calories, to_char(log_date,'YYYY-MM-DD') as date
         from workouts where user_id=$1 and log_date=$2 order by created_at`, [user.id, parsed.data]);
    return Response.json(result.rows);
  }
  const result = await db.query(
    `select id, title, minutes, calories, to_char(log_date,'YYYY-MM-DD') as date
       from workouts where user_id=$1 order by log_date desc, created_at desc limit 30`, [user.id]);
  return Response.json(result.rows);
}

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_workout" }, { status: 400 });
  const workout = parsed.data;
  const id = randomUUID();
  await db.query(`insert into profiles(user_id) values($1) on conflict(user_id) do nothing`, [user.id]);
  await db.query(
    `insert into workouts (id, user_id, log_date, title, minutes, calories)
     values ($1,$2,$3,$4,$5,$6)`, [id, user.id, workout.date, workout.title, workout.minutes, workout.calories]);
  // В ленту друзей уходит только факт и длительность — без названия и калорий.
  await db.query(
    `insert into activity_events (user_id, event_key, type, visibility, payload)
     select $1,$2,'workout','friends',jsonb_build_object('minutes',$3::int)
      where exists(select 1 from profiles where user_id=$1 and share_workouts=true)
     on conflict(user_id,event_key) do nothing`, [user.id, `workout:${id}`, workout.minutes]);
  return Response.json({ id, ...workout });
}

export async function DELETE(request: Request) {
  const user = await requireUser(request);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !z.string().uuid().safeParse(id).success)
    return Response.json({ error: "invalid_id" }, { status: 400 });
  const result = await db.query(`delete from workouts where id=$1 and user_id=$2`, [id, user.id]);
  await db.query(`delete from activity_events where user_id=$1 and event_key=$2`, [user.id, `workout:${id}`]);
  return Response.json({ ok: true, deleted: result.rowCount ?? 0 });
}
