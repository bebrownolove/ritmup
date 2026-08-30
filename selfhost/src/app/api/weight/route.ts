import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

/** История веса: только дни, где вес реально записан. */
export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const result = await db.query(
    `select to_char(log_date,'YYYY-MM-DD') as date, weight_kg::float8 as "weightKg"
       from daily_logs where user_id=$1 and weight_kg is not null
      order by log_date desc limit 60`, [user.id]);
  return Response.json(result.rows.reverse());
}
