import { db } from "@/lib/db";
import { generateHealthToken } from "@/lib/health-auth";
import { requireUser } from "@/lib/session";

type TokenRow = { token: string; lastUsedAt: string | null };

async function issue(userId: string) {
  const token = generateHealthToken();
  const result = await db.query<TokenRow>(
    `insert into health_tokens (user_id, token) values ($1,$2)
     on conflict (user_id) do update set token=excluded.token, created_at=now(), last_used_at=null
     returning token, last_used_at as "lastUsedAt"`, [userId, token]);
  return result.rows[0];
}

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const existing = await db.query<TokenRow>(
    `select token, last_used_at as "lastUsedAt" from health_tokens where user_id=$1`, [user.id]);
  return Response.json(existing.rows[0] ?? await issue(user.id));
}

/** Перевыпуск: старый ключ сразу перестаёт работать. */
export async function POST(request: Request) {
  const user = await requireUser(request);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json(await issue(user.id));
}
