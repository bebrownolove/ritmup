import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const result = await db.query(
    `select u.id,u.name,u.username,u.image,f.status,f.requester_id=$1 as "sentByMe",f.created_at as "createdAt"
       from friendships f join "user" u on u.id=case when f.requester_id=$1 then f.addressee_id else f.requester_id end
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
