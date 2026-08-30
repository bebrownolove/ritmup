import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export async function PATCH(request:Request, context:{params:Promise<{userId:string}>}) {
  const user=await requireUser(request);
  if(!user) return Response.json({error:"unauthorized"},{status:401});
  const {userId}=await context.params;
  const body=z.object({action:z.enum(["accept","reject"])}).safeParse(await request.json().catch(()=>null));
  if(!body.success) return Response.json({error:"invalid_action"},{status:400});
  if(body.data.action==="accept") {
    const result=await db.query(`update friendships set status='accepted',accepted_at=now() where requester_id=$1 and addressee_id=$2 and status='pending'`,[userId,user.id]);
    if(!result.rowCount) return Response.json({error:"request_not_found"},{status:404});
  } else await db.query(`delete from friendships where requester_id=$1 and addressee_id=$2 and status='pending'`,[userId,user.id]);
  return Response.json({ok:true});
}

export async function DELETE(request:Request, context:{params:Promise<{userId:string}>}) {
  const user=await requireUser(request);
  if(!user) return Response.json({error:"unauthorized"},{status:401});
  const {userId}=await context.params;
  await db.query(`delete from friendships where (requester_id=$1 and addressee_id=$2) or (requester_id=$2 and addressee_id=$1)`,[user.id,userId]);
  return Response.json({ok:true});
}
