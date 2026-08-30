import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return Response.json([]);
  const result = await db.query(
    `select u.id, u.name, u.username, u.image,
       case when f.status='accepted' then 'friends' when f.requester_id=$1 then 'outgoing'
            when f.addressee_id=$1 then 'incoming' else 'none' end as relationship
     from "user" u left join profiles p on p.user_id=u.id
     left join friendships f on (f.requester_id=$1 and f.addressee_id=u.id)
       or (f.addressee_id=$1 and f.requester_id=u.id)
     where u.id<>$1 and coalesce(p.is_discoverable,true)=true
       and (lower(u.username) like lower($2) or lower(u.name) like lower($2))
     order by case when lower(u.username)=lower($3) then 0 else 1 end, u.name limit 20`,
    [user.id, `%${query}%`, query]);
  return Response.json(result.rows);
}
