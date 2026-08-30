import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

const patchSchema = z.object({
  bio: z.string().trim().max(160).optional(),
  isDiscoverable: z.boolean().optional(),
  shareStreak: z.boolean().optional(),
  shareGoalHits: z.boolean().optional(),
  shareWorkouts: z.boolean().optional(),
  timezone: z.string().max(64).optional(),
  calorieGoal: z.coerce.number().int().min(500).max(10000).optional(),
  heightCm: z.coerce.number().int().min(100).max(250).nullish(),
  sex: z.enum(["male","female"]).nullish(),
  birthYear: z.coerce.number().int().min(1900).max(2100).nullish(),
  activityLevel: z.enum(["low","light","medium","high","athlete"]).optional(),
  targetWeightKg: z.coerce.number().min(20).max(400).nullish(),
  onboardingCompleted: z.boolean().optional(),
});

/** Пускаем в базу только настоящую зону IANA — иначе запрос с ней потом упадёт. */
function validTimezone(value: string | undefined) {
  if (!value) return undefined;
  try { new Intl.DateTimeFormat("en", { timeZone: value }); return value; } catch { return undefined; }
}

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  await db.query(`insert into profiles (user_id) values ($1) on conflict (user_id) do nothing`, [user.id]);
  const result = await db.query(
    `select bio, is_discoverable as "isDiscoverable", share_streak as "shareStreak",
            share_goal_hits as "shareGoalHits", share_workouts as "shareWorkouts", timezone, calorie_goal as "calorieGoal",
            height_cm as "heightCm", sex, birth_year as "birthYear",
            activity_level as "activityLevel", target_weight_kg::float8 as "targetWeightKg", coins,
            onboarding_completed as "onboardingCompleted"
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
    `insert into profiles (user_id, bio, is_discoverable, share_streak, share_goal_hits, share_workouts, timezone, calorie_goal,
       height_cm, sex, birth_year, activity_level, target_weight_kg, onboarding_completed)
     values ($1, $2, $3, $4, $5, $6, $7, coalesce($8,2000), $9, $10, $11, coalesce($12,'light'), $13, coalesce($14,false))
     on conflict (user_id) do update set bio=excluded.bio, is_discoverable=excluded.is_discoverable,
       share_streak=excluded.share_streak, share_goal_hits=excluded.share_goal_hits,
       share_workouts=excluded.share_workouts, timezone=excluded.timezone,
       calorie_goal=coalesce($8,profiles.calorie_goal),
       height_cm=coalesce($9,profiles.height_cm), sex=coalesce($10,profiles.sex),
       birth_year=coalesce($11,profiles.birth_year),
       activity_level=coalesce($12,profiles.activity_level),
       target_weight_kg=coalesce($13,profiles.target_weight_kg),
       onboarding_completed=coalesce($14,profiles.onboarding_completed)`,
    [user.id, value.bio ?? old.bio ?? "", value.isDiscoverable ?? old.is_discoverable ?? true,
      value.shareStreak ?? old.share_streak ?? true, value.shareGoalHits ?? old.share_goal_hits ?? true,
      value.shareWorkouts ?? old.share_workouts ?? true,
      validTimezone(value.timezone) ?? old.timezone ?? null,
      value.calorieGoal ?? null, value.heightCm ?? null, value.sex ?? null,
      value.birthYear ?? null, value.activityLevel ?? null, value.targetWeightKg ?? null,
      value.onboardingCompleted ?? null]);
  return Response.json({ ok: true });
}
