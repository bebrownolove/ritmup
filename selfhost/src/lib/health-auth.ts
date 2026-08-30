import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export function generateHealthToken() {
  return randomBytes(24).toString("base64url");
}

/** Токен передаётся только заголовком Authorization: он не попадает в логи и историю URL. */
function bearerToken(request: Request) {
  const header = request.headers.get("authorization")?.trim() ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  return match?.[1] ?? null;
}

/** Возвращает id пользователя по токену Shortcuts либо по обычной сессии в браузере. */
export async function resolveHealthUserId(request: Request) {
  const token = bearerToken(request);
  if (token) {
    const result = await db.query<{ user_id: string }>(
      `update health_tokens set last_used_at=now() where token=$1 returning user_id`, [token]);
    return result.rows[0]?.user_id ?? null;
  }
  const user = await requireUser(request);
  return user?.id ?? null;
}
