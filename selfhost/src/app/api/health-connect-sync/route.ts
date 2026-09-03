import { z } from "zod";
import { db } from "@/lib/db";
import { resolveHealthUserId } from "@/lib/health-auth";

/**
 * Приёмник для приложения «HC Webhook» (Health Connect → вебхук на Android).
 * Синхронизирует Samsung Health, Google Fit и другие через системный Health
 * Connect — Ритм сам к нему обратиться не может, поэтому мост держит
 * сторонний бесплатный опенсорсный клиент на телефоне.
 *
 * Формат отличается от /api/health-sync (та команда для iPhone Shortcuts
 * присылает уже готовые дневные итоги). HC Webhook шлёт сырые записи за
 * скользящее окно в 48 часов и досылает только новое с прошлой отправки —
 * поэтому здесь не перезаписываем дневной итог, а прибавляем к нему.
 * Это верно для фонового расписания; ручной полный пересинк в приложении
 * задвоит шаги и калории за задетый день — пересинк такого рода редкий
 * ручной сценарий, а не обычная работа синхронизации.
 */

const isoString = z.string().min(1);

const schema = z.object({
  steps: z.array(z.object({ count: z.number().min(0), start_time: isoString })).optional(),
  active_calories: z.array(z.object({ calories: z.number().min(0), start_time: isoString })).optional(),
  exercise: z.array(z.object({ start_time: isoString, duration_seconds: z.number().min(0).optional() })).optional(),
  weight: z.array(z.object({ kilograms: z.number().min(20).max(400), time: isoString })).optional(),
});

/** Дата в часовом поясе пользователя, а не в UTC, в котором приходят метки времени. */
function localDate(iso: string, timeZone: string) {
  const moment = new Date(iso);
  if (Number.isNaN(moment.getTime())) return null;
  try {
    // en-CA форматирует как YYYY-MM-DD — не нужно переставлять части.
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(moment);
  } catch {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(moment);
  }
}

export async function POST(request: Request) {
  const userId = await resolveHealthUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_payload" }, { status: 400 });
  const body = parsed.data;
  if (!body.steps?.length && !body.active_calories?.length && !body.exercise?.length && !body.weight?.length)
    return Response.json({ ok: true, days: [] });

  await db.query(`insert into profiles(user_id) values($1) on conflict(user_id) do nothing`, [userId]);
  const zone = (await db.query<{ timezone: string | null }>(
    `select timezone from profiles where user_id=$1`, [userId])).rows[0]?.timezone ?? "UTC";

  type DayTotals = { steps: number; activeCalories: number; exerciseMinutes: number; weightKg: number | null; weightAt: string };
  const byDay = new Map<string, DayTotals>();
  const bucket = (date: string) => {
    let entry = byDay.get(date);
    if (!entry) { entry = { steps: 0, activeCalories: 0, exerciseMinutes: 0, weightKg: null, weightAt: "" }; byDay.set(date, entry); }
    return entry;
  };

  for (const item of body.steps ?? []) {
    const date = localDate(item.start_time, zone);
    if (date) bucket(date).steps += item.count;
  }
  for (const item of body.active_calories ?? []) {
    const date = localDate(item.start_time, zone);
    if (date) bucket(date).activeCalories += item.calories;
  }
  for (const item of body.exercise ?? []) {
    const date = localDate(item.start_time, zone);
    if (date) bucket(date).exerciseMinutes += (item.duration_seconds ?? 0) / 60;
  }
  // Вес не суммируется — берём самую позднюю запись за день.
  for (const item of body.weight ?? []) {
    const date = localDate(item.time, zone);
    if (!date) continue;
    const entry = bucket(date);
    if (item.time > entry.weightAt) { entry.weightKg = item.kilograms; entry.weightAt = item.time; }
  }

  const days = [...byDay.entries()];
  for (const [date, totals] of days) {
    await db.query(
      `insert into daily_logs (user_id, log_date, calories_eaten, active_calories, calorie_goal, steps, exercise_minutes, weight_kg, health_synced_at)
       values ($1,$2,0,least($3,20000),coalesce((select calorie_goal from profiles where user_id=$1),2000),least($4,200000),least($5,1440),$6,now())
       on conflict (user_id,log_date) do update set
         active_calories=least(coalesce(daily_logs.active_calories,0)+$3,20000),
         steps=least(coalesce(daily_logs.steps,0)+$4,200000),
         exercise_minutes=least(coalesce(daily_logs.exercise_minutes,0)+$5,1440),
         weight_kg=coalesce($6,daily_logs.weight_kg),
         health_synced_at=now(), updated_at=now()`,
      [userId, date, Math.round(totals.activeCalories), Math.round(totals.steps), Math.round(totals.exerciseMinutes), totals.weightKg]);
  }
  return Response.json({ ok: true, days: days.map(([date]) => date) });
}
