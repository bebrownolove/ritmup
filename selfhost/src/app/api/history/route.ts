import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

/** Последние дни вместе с конкретными блюдами и тренировками для дневника. */
export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const raw = Number(new URL(request.url).searchParams.get("days") ?? 30);
  const days = Math.min(180, Math.max(7, Number.isFinite(raw) ? Math.round(raw) : 30));
  const result = await db.query(
    `with zone as (select coalesce(timezone,'UTC') as tz from profiles where user_id=$1)
     select to_char(d.day,'YYYY-MM-DD') as date,
            coalesce(l.calories_eaten,0) as "caloriesEaten",
            coalesce(l.calorie_goal,(select calorie_goal from profiles where user_id=$1),2000) as "calorieGoal",
            l.weight_kg::float8 as "weightKg",
            l.steps, coalesce(l.active_calories,0) as "activeCalories",
            coalesce(w.minutes,0) as "workoutMinutes",
            coalesce(food.items,'[]'::json) as food,
            coalesce(w.items,'[]'::json) as workouts
       from generate_series(
              -- Не показываем дни до регистрации: иначе новый аккаунт видит месяц пустых столбиков.
              greatest(
                (now() at time zone (select tz from zone))::date - ($2::int - 1),
                ((select "createdAt" from "user" where id=$1) at time zone (select tz from zone))::date),
              (now() at time zone (select tz from zone))::date,
              interval '1 day') as d(day)
       left join daily_logs l on l.user_id=$1 and l.log_date=d.day
       left join lateral (
         select json_agg(json_build_object('title',e.title,'calories',e.calories) order by e.created_at) as items
           from food_entries e where e.user_id=$1 and e.log_date=d.day
       ) food on true
       left join lateral (
         select sum(x.minutes)::int as minutes,
                json_agg(json_build_object('title',x.title,'minutes',x.minutes,'calories',x.calories) order by x.created_at) as items
           from workouts x where x.user_id=$1 and x.log_date=d.day
       ) w on true
      order by d.day`, [user.id, days]);
  return Response.json(result.rows);
}
