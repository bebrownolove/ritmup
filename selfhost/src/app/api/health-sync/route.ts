import { z } from "zod";
import { db } from "@/lib/db";
import { resolveHealthUserId } from "@/lib/health-auth";

// Метрики опциональны: команда Shortcuts может присылать только шаги или только вес.
const schema = z.object({
  // Дата не обязательна: без неё берём сегодняшний день в часовом поясе пользователя,
  // чтобы команде на iPhone не приходилось её форматировать.
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  // Apple Health отдаёт дробные значения (132.695 ккал), поэтому округляем,
  // а не требуем целое: иначе команда с iPhone получала бы 400.
  activeCalories: z.coerce.number().min(0).max(20000).nullish().transform(v=>v==null?v:Math.round(v)),
  steps: z.coerce.number().min(0).max(200000).nullish().transform(v=>v==null?v:Math.round(v)),
  exerciseMinutes: z.coerce.number().min(0).max(1440).nullish().transform(v=>v==null?v:Math.round(v)),
  weightKg: z.coerce.number().min(20).max(400).nullish(),
}).refine((value) => value.activeCalories != null || value.steps != null
  || value.exerciseMinutes != null || value.weightKg != null, { message: "no_metrics" });

export async function POST(request: Request) {
  const userId = await resolveHealthUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_health_snapshot" }, { status: 400 });
  const snapshot = parsed.data;
  await db.query(`insert into profiles(user_id) values($1) on conflict(user_id) do nothing`, [userId]);
  const day = snapshot.date ?? (await db.query<{ today: string }>(
    `select to_char((now() at time zone coalesce(timezone,'UTC'))::date,'YYYY-MM-DD') as today
       from profiles where user_id=$1`, [userId])).rows[0].today;
  const result = await db.query(`insert into daily_logs
    (user_id,log_date,calories_eaten,active_calories,calorie_goal,steps,exercise_minutes,weight_kg,health_synced_at)
    values ($1,$2,0,coalesce($3,0),2000,$4,$5,$6,now())
    on conflict (user_id,log_date) do update set
      active_calories=coalesce($3,daily_logs.active_calories),
      steps=coalesce($4,daily_logs.steps),
      exercise_minutes=coalesce($5,daily_logs.exercise_minutes),
      weight_kg=coalesce($6,daily_logs.weight_kg),
      health_synced_at=now(), updated_at=now()
    returning active_calories as "activeCalories", steps, exercise_minutes as "exerciseMinutes",
      weight_kg::float8 as "weightKg", health_synced_at as "healthSyncedAt"`,
    [userId, day, snapshot.activeCalories ?? null, snapshot.steps ?? null,
      snapshot.exerciseMinutes ?? null, snapshot.weightKg ?? null]);
  return Response.json({ ok: true, ...result.rows[0] });
}
