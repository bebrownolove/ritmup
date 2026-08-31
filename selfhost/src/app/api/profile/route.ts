import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { AVATAR_VALUES, normalizeAvatar } from "@/lib/avatar";

const avatarSchema=z.object({
  skin:z.enum(AVATAR_VALUES.skin),head:z.enum(AVATAR_VALUES.head),hair:z.enum(AVATAR_VALUES.hair),hairColor:z.enum(AVATAR_VALUES.hairColor),
  eyes:z.enum(AVATAR_VALUES.eyes),mouth:z.enum(AVATAR_VALUES.mouth),outfit:z.enum(AVATAR_VALUES.outfit),headwear:z.enum(AVATAR_VALUES.headwear),
  glasses:z.enum(AVATAR_VALUES.glasses),piercing:z.enum(AVATAR_VALUES.piercing),tattoo:z.enum(AVATAR_VALUES.tattoo),accessory:z.enum(AVATAR_VALUES.accessory),background:z.enum(AVATAR_VALUES.background),
});

const patchSchema = z.object({
  bio: z.string().trim().max(160).optional(),
  isDiscoverable: z.boolean().optional(),
  shareStreak: z.boolean().optional(),
  shareGoalHits: z.boolean().optional(),
  shareWorkouts: z.boolean().optional(),
  shareWeight: z.boolean().optional(),
  shareCalories: z.boolean().optional(),
  shareSteps: z.boolean().optional(),
  timezone: z.string().max(64).optional(),
  calorieGoal: z.coerce.number().int().min(500).max(10000).optional(),
  heightCm: z.coerce.number().int().min(100).max(250).nullish(),
  sex: z.enum(["male","female"]).nullish(),
  birthYear: z.coerce.number().int().min(1900).max(2100).nullish(),
  activityLevel: z.enum(["low","light","medium","high","athlete"]).optional(),
  targetWeightKg: z.coerce.number().min(20).max(400).nullish(),
  goalDirection: z.enum(["lose","keep","gain"]).optional(),
  avatarConfig: avatarSchema.optional(),
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
            share_goal_hits as "shareGoalHits", share_workouts as "shareWorkouts",
            share_weight as "shareWeight", share_calories as "shareCalories", share_steps as "shareSteps",
            timezone, calorie_goal as "calorieGoal",
            height_cm as "heightCm", sex, birth_year as "birthYear",
            activity_level as "activityLevel", target_weight_kg::float8 as "targetWeightKg",
            goal_direction as "goalDirection", avatar_config as "avatarConfig", coins,
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
       height_cm, sex, birth_year, activity_level, target_weight_kg, onboarding_completed, goal_direction, avatar_config,
       share_weight, share_calories, share_steps)
     values ($1, $2, $3, $4, $5, $6, $7, coalesce($8,2000), $9, $10, $11, coalesce($12,'light'), $13, coalesce($14,false), $15, coalesce($16::jsonb,'{}'::jsonb), $17, $18, $19)
     on conflict (user_id) do update set bio=excluded.bio, is_discoverable=excluded.is_discoverable,
       share_streak=excluded.share_streak, share_goal_hits=excluded.share_goal_hits,
       share_workouts=excluded.share_workouts, timezone=excluded.timezone,
       calorie_goal=coalesce($8,profiles.calorie_goal),
       height_cm=coalesce($9,profiles.height_cm), sex=coalesce($10,profiles.sex),
       birth_year=coalesce($11,profiles.birth_year),
       activity_level=coalesce($12,profiles.activity_level),
       target_weight_kg=coalesce($13,profiles.target_weight_kg),
       onboarding_completed=coalesce($14,profiles.onboarding_completed),
       goal_direction=coalesce($15,profiles.goal_direction),
       avatar_config=coalesce($16::jsonb,profiles.avatar_config),
       share_weight=coalesce($17,profiles.share_weight),
       share_calories=coalesce($18,profiles.share_calories),
       share_steps=coalesce($19,profiles.share_steps)`,
    [user.id, value.bio ?? old.bio ?? "", value.isDiscoverable ?? old.is_discoverable ?? true,
      value.shareStreak ?? old.share_streak ?? true, value.shareGoalHits ?? old.share_goal_hits ?? true,
      value.shareWorkouts ?? old.share_workouts ?? true,
      validTimezone(value.timezone) ?? old.timezone ?? null,
      value.calorieGoal ?? null, value.heightCm ?? null, value.sex ?? null,
      value.birthYear ?? null, value.activityLevel ?? null, value.targetWeightKg ?? null,
      value.onboardingCompleted ?? null, value.goalDirection ?? null,
      value.avatarConfig ? JSON.stringify(normalizeAvatar(value.avatarConfig)) : null,
      value.shareWeight ?? old.share_weight ?? false,
      value.shareCalories ?? old.share_calories ?? false,
      value.shareSteps ?? old.share_steps ?? false]);
  // Новая норма должна сразу появиться на экране «Сегодня». Раньше дневная
  // запись продолжала хранить старые 2000 ккал и перекрывала профиль.
  if (value.calorieGoal !== undefined) {
    await db.query(
      `update daily_logs d set calorie_goal=$2, updated_at=now()
        from profiles p
       where p.user_id=$1 and d.user_id=p.user_id
         and d.log_date=(now() at time zone coalesce(p.timezone,'UTC'))::date`,
      [user.id, value.calorieGoal]);
  }
  return Response.json({ ok: true });
}
