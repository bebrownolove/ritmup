import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

/** Последние дни: еда, норма, вес, шаги и минуты тренировок одним запросом. */
export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const raw = Number(new URL(request.url).searchParams.get("days") ?? 30);
  const days = Math.min(180, Math.max(7, Number.isFinite(raw) ? Math.round(raw) : 30));
  const result = await db.query(
    `select to_char(d.day,'YYYY-MM-DD') as date,
            coalesce(l.calories_eaten,0) as "caloriesEaten",
            coalesce(l.calorie_goal,(select calorie_goal from profiles where user_id=$1),2000) as "calorieGoal",
            l.weight_kg::float8 as "weightKg",
            l.steps, coalesce(l.active_calories,0) as "activeCalories",
            coalesce(w.minutes,0) as "workoutMinutes"
       from generate_series(
              (now() at time zone coalesce((select timezone from profiles where user_id=$1),'UTC'))::date - ($2::int - 1),
              (now() at time zone coalesce((select timezone from profiles where user_id=$1),'UTC'))::date,
              interval '1 day') as d(day)
       left join daily_logs l on l.user_id=$1 and l.log_date=d.day
       left join (select log_date, sum(minutes)::int as minutes from workouts
                   where user_id=$1 group by log_date) w on w.log_date=d.day
      order by d.day`, [user.id, days]);
  return Response.json(result.rows);
}
