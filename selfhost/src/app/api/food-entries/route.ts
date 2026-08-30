import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

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
  return Response.json({ id, title: entry.title, calories: entry.calories });
}

/** Удаляем только свою запись: чужой id ничего не тронет. */
export async function DELETE(request: Request) {
  const user = await requireUser(request);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !z.string().uuid().safeParse(id).success)
    return Response.json({ error: "invalid_id" }, { status: 400 });
  const result = await db.query(`delete from food_entries where id=$1 and user_id=$2`, [id, user.id]);
  return Response.json({ ok: true, deleted: result.rowCount ?? 0 });
}
