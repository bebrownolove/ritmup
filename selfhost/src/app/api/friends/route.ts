import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const result = await db.query(
    `select u.id,u.name,u.username,u.image,p.avatar_config as "avatarConfig",f.status,f.requester_id=$1 as "sentByMe",f.created_at as "createdAt",
            case when f.status='accepted' and coalesce(p.share_weight,false) then latest.weight_kg::float8 end as "sharedWeightKg",
            case when f.status='accepted' and coalesce(p.share_calories,false) then today.calories_eaten end as "sharedCalories",
            case when f.status='accepted' and coalesce(p.share_steps,false) then today.steps end as "sharedSteps",
            case when f.status='accepted' and coalesce(p.share_food,false) then coalesce(food.items,'{}'::text[]) else '{}'::text[] end as "sharedFood",
            case when f.status='accepted' then coalesce(p.share_weight,false) else false end as "sharesWeight",
            case when f.status='accepted' then coalesce(p.share_calories,false) else false end as "sharesCalories",
            case when f.status='accepted' then coalesce(p.share_steps,false) else false end as "sharesSteps",
            case when f.status='accepted' then coalesce(p.share_food,false) else false end as "sharesFood"
       from friendships f join "user" u on u.id=case when f.requester_id=$1 then f.addressee_id else f.requester_id end
       left join profiles p on p.user_id=u.id
       left join lateral (select d.weight_kg from daily_logs d where d.user_id=u.id and d.weight_kg is not null order by d.log_date desc limit 1) latest on true
       left join lateral (select d.calories_eaten,d.steps from daily_logs d where d.user_id=u.id and d.log_date=(now() at time zone coalesce(p.timezone,'UTC'))::date limit 1) today on true
       left join lateral (select array_agg(e.title order by e.created_at) as items from food_entries e where e.user_id=u.id and e.log_date=(now() at time zone coalesce(p.timezone,'UTC'))::date) food on true
      where f.requester_id=$1 or f.addressee_id=$1 order by f.created_at desc`, [user.id]);
  return Response.json(result.rows);
}

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const parsed = z.object({ userId: z.string().min(1) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.userId===user.id) return Response.json({ error:"invalid_user" }, { status:400 });
  const target = await db.query(`select u.id from "user" u left join profiles p on p.user_id=u.id where u.id=$1 and coalesce(p.is_discoverable,true)=true`, [parsed.data.userId]);
  if (!target.rowCount) return Response.json({ error:"user_not_found" }, { status:404 });
  try {
    await db.query(`insert into friendships (requester_id,addressee_id) values ($1,$2)`, [user.id,parsed.data.userId]);
    return Response.json({ ok:true }, { status:201 });
  } catch (error) {
    if ((error as {code?:string}).code==="23505") return Response.json({ error:"request_exists" }, { status:409 });
    throw error;
  }
}
