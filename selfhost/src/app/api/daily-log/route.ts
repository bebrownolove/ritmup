import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { currentStreak, publishStreak } from "@/lib/streak";

const dateSchema=z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
// Всё, кроме даты, необязательно: экран может прислать один только вес,
// не трогая съеденные калории и цель.
const schema=z.object({date:dateSchema,
  caloriesEaten:z.number().int().min(0).max(20000).optional(),
  activeCalories:z.number().int().min(0).max(20000).optional(),
  calorieGoal:z.number().int().min(500).max(10000).optional(),
  weightKg:z.number().min(20).max(400).nullable().optional(),
});

export async function GET(request:Request) {
  const user=await requireUser(request);
  if(!user) return Response.json({error:"unauthorized"},{status:401});
  const parsed=dateSchema.safeParse(new URL(request.url).searchParams.get("date"));
  if(!parsed.success) return Response.json({error:"invalid_date"},{status:400});
  const result=await db.query(`select calories_eaten as "caloriesEaten", active_calories as "activeCalories",
    calorie_goal as "calorieGoal", steps, exercise_minutes as "exerciseMinutes",
    weight_kg::float8 as "weightKg", health_synced_at as "healthSyncedAt"
    from daily_logs where user_id=$1 and log_date=$2`,[user.id,parsed.data]);
  if(result.rows[0]) return Response.json(result.rows[0]);
  // Дня ещё нет — показываем личную норму, а не общее число.
  const profile=await db.query<{calorieGoal:number}>(`select calorie_goal as "calorieGoal" from profiles where user_id=$1`,[user.id]);
  return Response.json({caloriesEaten:0,activeCalories:0,calorieGoal:profile.rows[0]?.calorieGoal??2000,
    steps:null,exerciseMinutes:null,weightKg:null,healthSyncedAt:null});
}

export async function POST(request:Request) {
  const user=await requireUser(request);
  if(!user) return Response.json({error:"unauthorized"},{status:401});
  const parsed=schema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success) return Response.json({error:"invalid_log"},{status:400});
  const l=parsed.data;
  await db.query(`insert into profiles(user_id) values($1) on conflict(user_id) do nothing`,[user.id]);
  const result=await db.query(`insert into daily_logs (user_id,log_date,calories_eaten,active_calories,calorie_goal,weight_kg)
    values ($1,$2,coalesce($3,0),coalesce($4,0),coalesce($5,(select calorie_goal from profiles where user_id=$1),2000),$6)
    on conflict (user_id,log_date) do update set
      calories_eaten=coalesce($3,daily_logs.calories_eaten),
      active_calories=coalesce($4,daily_logs.active_calories),
      calorie_goal=coalesce($5,daily_logs.calorie_goal),
      weight_kg=coalesce($6,daily_logs.weight_kg),updated_at=now()
    returning calories_eaten as "caloriesEaten", active_calories as "activeCalories",
      calorie_goal as "calorieGoal", steps, exercise_minutes as "exerciseMinutes",
      weight_kg::float8 as "weightKg", health_synced_at as "healthSyncedAt"`,
    [user.id,l.date,l.caloriesEaten??null,l.activeCalories??null,l.calorieGoal??null,l.weightKg??null]);
  // Серию считает сервер: клиент раньше присылал единицу независимо от истории.
  const streak=await currentStreak(user.id);
  await publishStreak(user.id,l.date,streak);
  return Response.json({ok:true,streak,...result.rows[0]});
}
