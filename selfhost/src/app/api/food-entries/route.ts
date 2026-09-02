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
    `with totals as (
       select coalesce(sum(calories),0)::int as calories,
              coalesce(sum(protein_g),0) as protein,
              coalesce(sum(fat_g),0) as fat,
              coalesce(sum(carbs_g),0) as carbs
         from food_entries where user_id=$1 and log_date=$2)
     insert into daily_logs (user_id, log_date, calories_eaten, calorie_goal, protein_g, fat_g, carbs_g)
     select $1,$2,totals.calories,
            coalesce((select calorie_goal from profiles where user_id=$1),2000),
            totals.protein, totals.fat, totals.carbs
       from totals
     on conflict (user_id, log_date) do update
        set calories_eaten=excluded.calories_eaten,
            protein_g=excluded.protein_g, fat_g=excluded.fat_g, carbs_g=excluded.carbs_g,
            updated_at=now()`, [userId, date]);
}

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const createSchema = z.object({
  date: dateSchema,
  title: z.string().trim().min(1).max(120),
  calories: z.coerce.number().min(0).max(10000).transform(v => Math.round(v)),
  proteinG: z.coerce.number().min(0).max(2000).nullish(),
  fatG: z.coerce.number().min(0).max(2000).nullish(),
  carbsG: z.coerce.number().min(0).max(2000).nullish(),
});

/** В базе граммы с одним знаком после запятой — округляем на входе. */
function grams(value: number | null | undefined) {
  return value === null || value === undefined ? null : Math.round(value * 10) / 10;
}

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const parsed = dateSchema.safeParse(new URL(request.url).searchParams.get("date"));
  if (!parsed.success) return Response.json({ error: "invalid_date" }, { status: 400 });
  const result = await db.query(
    `select id, title, calories,
            protein_g::float8 as "proteinG", fat_g::float8 as "fatG", carbs_g::float8 as "carbsG"
       from food_entries
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
  const protein=grams(entry.proteinG), fat=grams(entry.fatG), carbs=grams(entry.carbsG);
  await db.query(
    `insert into food_entries (id, user_id, log_date, title, meal, calories, protein_g, fat_g, carbs_g)
     values ($1,$2,$3,$4,'other',$5,$6,$7,$8)`,
    [id, user.id, entry.date, entry.title, entry.calories, protein, fat, carbs]);
  await recalculate(user.id, entry.date);
  await awardDay(user.id, entry.date);
  await publishStreak(user.id, entry.date, await currentStreak(user.id));
  return Response.json({ id, title: entry.title, calories: entry.calories, proteinG: protein, fatG: fat, carbsG: carbs });
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
