import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

const dateSchema=z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const schema=z.object({date:dateSchema,caloriesEaten:z.number().int().min(0).max(20000),
  activeCalories:z.number().int().min(0).max(20000).optional(),calorieGoal:z.number().int().min(500).max(10000),
  weightKg:z.number().min(20).max(400).nullable().optional(),streak:z.number().int().min(0).max(100000).optional()});

export async function GET(request:Request) {
  const user=await requireUser(request);
  if(!user) return Response.json({error:"unauthorized"},{status:401});
  const parsed=dateSchema.safeParse(new URL(request.url).searchParams.get("date"));
  if(!parsed.success) return Response.json({error:"invalid_date"},{status:400});
  const result=await db.query(`select calories_eaten as "caloriesEaten", active_calories as "activeCalories",
    calorie_goal as "calorieGoal", steps, exercise_minutes as "exerciseMinutes",
    weight_kg::float8 as "weightKg", health_synced_at as "healthSyncedAt"
    from daily_logs where user_id=$1 and log_date=$2`,[user.id,parsed.data]);
  return Response.json(result.rows[0]??{caloriesEaten:0,activeCalories:0,calorieGoal:2000,steps:null,exerciseMinutes:null,weightKg:null,healthSyncedAt:null});
}

export async function POST(request:Request) {
  const user=await requireUser(request);
  if(!user) return Response.json({error:"unauthorized"},{status:401});
  const parsed=schema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success) return Response.json({error:"invalid_log"},{status:400});
  const l=parsed.data;
  await db.query(`insert into profiles(user_id) values($1) on conflict(user_id) do nothing`,[user.id]);
  await db.query(`insert into daily_logs (user_id,log_date,calories_eaten,active_calories,calorie_goal,weight_kg)
    values ($1,$2,$3,$4,$5,$6) on conflict (user_id,log_date) do update set calories_eaten=excluded.calories_eaten,
    active_calories=coalesce($4,daily_logs.active_calories),calorie_goal=excluded.calorie_goal,
    weight_kg=coalesce($6,daily_logs.weight_kg),updated_at=now()`,
    [user.id,l.date,l.caloriesEaten,l.activeCalories??null,l.calorieGoal,l.weightKg??null]);
  if(l.streak&&l.streak>0) await db.query(`insert into activity_events (user_id,event_key,type,visibility,payload)
    select $1,$2,'streak','friends',jsonb_build_object('days',$3::int)
    where exists(select 1 from profiles where user_id=$1 and share_streak=true)
    on conflict(user_id,event_key) do update set payload=excluded.payload`,[user.id,`streak:${l.date}`,l.streak]);
  return Response.json({ok:true});
}
