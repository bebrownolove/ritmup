import { z } from "zod";
import { db } from "@/lib/db";
import { resolveHealthUserId } from "@/lib/health-auth";

// Метрики опциональны: команда Shortcuts может присылать только шаги или только вес.
const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  activeCalories: z.coerce.number().int().min(0).max(20000).nullish(),
  steps: z.coerce.number().int().min(0).max(200000).nullish(),
  exerciseMinutes: z.coerce.number().int().min(0).max(1440).nullish(),
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
    [userId, snapshot.date, snapshot.activeCalories ?? null, snapshot.steps ?? null,
      snapshot.exerciseMinutes ?? null, snapshot.weightKg ?? null]);
  return Response.json({ ok: true, ...result.rows[0] });
}
