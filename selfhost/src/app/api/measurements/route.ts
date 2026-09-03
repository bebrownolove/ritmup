import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const cm = (min: number, max: number) => z.number().min(min).max(max).nullable().optional();

// Все шесть опциональны — за один раз можно занести хоть одну мерку,
// но хотя бы одна должна быть указана (проверяется отдельно ниже).
const schema = z.object({
  date: dateSchema,
  waistCm: cm(30, 250),
  bellyCm: cm(30, 250),
  hipsCm: cm(30, 250),
  thighCm: cm(15, 150),
  armCm: cm(10, 100),
  chestCm: cm(30, 250),
});

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const result = await db.query(
    `select to_char(log_date,'YYYY-MM-DD') as date,
            waist_cm::float8 as "waistCm", belly_cm::float8 as "bellyCm",
            hips_cm::float8 as "hipsCm", thigh_cm::float8 as "thighCm",
            arm_cm::float8 as "armCm", chest_cm::float8 as "chestCm"
       from body_measurements where user_id=$1
      order by log_date desc limit 60`, [user.id]);
  return Response.json(result.rows.reverse());
}

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_measurement" }, { status: 400 });
  const value = parsed.data;
  const fields = [value.waistCm, value.bellyCm, value.hipsCm, value.thighCm, value.armCm, value.chestCm];
  if (fields.every(field => field === null || field === undefined))
    return Response.json({ error: "nothing_to_save" }, { status: 400 });

  const result = await db.query(
    `insert into body_measurements (user_id, log_date, waist_cm, belly_cm, hips_cm, thigh_cm, arm_cm, chest_cm)
     values ($1,$2,$3,$4,$5,$6,$7,$8)
     on conflict (user_id, log_date) do update set
       waist_cm=coalesce($3,body_measurements.waist_cm),
       belly_cm=coalesce($4,body_measurements.belly_cm),
       hips_cm=coalesce($5,body_measurements.hips_cm),
       thigh_cm=coalesce($6,body_measurements.thigh_cm),
       arm_cm=coalesce($7,body_measurements.arm_cm),
       chest_cm=coalesce($8,body_measurements.chest_cm),
       updated_at=now()
     returning to_char(log_date,'YYYY-MM-DD') as date,
       waist_cm::float8 as "waistCm", belly_cm::float8 as "bellyCm",
       hips_cm::float8 as "hipsCm", thigh_cm::float8 as "thighCm",
       arm_cm::float8 as "armCm", chest_cm::float8 as "chestCm"`,
    [user.id, value.date, value.waistCm ?? null, value.bellyCm ?? null, value.hipsCm ?? null,
      value.thighCm ?? null, value.armCm ?? null, value.chestCm ?? null]);
  return Response.json(result.rows[0]);
}
