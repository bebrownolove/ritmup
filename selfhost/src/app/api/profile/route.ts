import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

const patchSchema = z.object({
  bio: z.string().trim().max(160).optional(),
  isDiscoverable: z.boolean().optional(),
  shareStreak: z.boolean().optional(),
  shareGoalHits: z.boolean().optional(),
  shareWorkouts: z.boolean().optional(),
});

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  await db.query(`insert into profiles (user_id) values ($1) on conflict (user_id) do nothing`, [user.id]);
  const result = await db.query(
    `select bio, is_discoverable as "isDiscoverable", share_streak as "shareStreak",
            share_goal_hits as "shareGoalHits", share_workouts as "shareWorkouts"
       from profiles where user_id = $1`, [user.id]);
  return Response.json(result.rows[0]);
}

export async function PATCH(request: Request) {
  const user = await requireUser(request);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_profile" }, { status: 400 });
  const current = await db.query(`select * from profiles where user_id = $1`, [user.id]);
  const old = current.rows[0] ?? {};
  const value = parsed.data;
  await db.query(
    `insert into profiles (user_id, bio, is_discoverable, share_streak, share_goal_hits, share_workouts)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (user_id) do update set bio=excluded.bio, is_discoverable=excluded.is_discoverable,
       share_streak=excluded.share_streak, share_goal_hits=excluded.share_goal_hits,
       share_workouts=excluded.share_workouts`,
    [user.id, value.bio ?? old.bio ?? "", value.isDiscoverable ?? old.is_discoverable ?? true,
      value.shareStreak ?? old.share_streak ?? true, value.shareGoalHits ?? old.share_goal_hits ?? true,
      value.shareWorkouts ?? old.share_workouts ?? true]);
  return Response.json({ ok: true });
}
