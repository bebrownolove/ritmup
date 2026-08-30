import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export async function GET(request:Request) {
  const user=await requireUser(request);
  if(!user) return Response.json({error:"unauthorized"},{status:401});
  const result=await db.query(
    `select e.id,e.type,e.payload,e.created_at as "createdAt",u.id as "userId",u.name,u.username,u.image
       from activity_events e join "user" u on u.id=e.user_id
      where e.user_id=$1 or (e.visibility in ('friends','public') and exists (
        select 1 from friendships f where f.status='accepted' and
        ((f.requester_id=$1 and f.addressee_id=e.user_id) or (f.addressee_id=$1 and f.requester_id=e.user_id))))
      order by e.created_at desc limit 50`,[user.id]);
  return Response.json(result.rows);
}
