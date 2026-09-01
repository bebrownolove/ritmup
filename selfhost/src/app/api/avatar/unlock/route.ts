import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { balanceOf } from "@/lib/coins";
import { AVATAR_VALUES, lockCost, unlockId, type AvatarConfig } from "@/lib/avatar";

const schema = z.object({
  category: z.enum(Object.keys(AVATAR_VALUES) as [keyof AvatarConfig, ...(keyof AvatarConfig)[]]),
  key: z.string().min(1).max(32),
});

/**
 * Покупка детали внешности за монеты. Цену берём из серверного справочника,
 * а не из запроса, и списываем условием внутри UPDATE — иначе два
 * одновременных запроса увели бы баланс в минус.
 */
export async function POST(request: Request) {
  const user = await requireUser(request);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_item" }, { status: 400 });
  const { category, key } = parsed.data;
  if (!(AVATAR_VALUES[category] as readonly string[]).includes(key))
    return Response.json({ error: "invalid_item" }, { status: 400 });

  const cost = lockCost(category, key);
  if (!cost) return Response.json({ error: "not_for_sale" }, { status: 400 });
  const id = unlockId(category, key);

  await db.query(`insert into profiles (user_id) values ($1) on conflict (user_id) do nothing`, [user.id]);
  const owned = await db.query(
    `select 1 from profiles where user_id=$1 and $2 = any(avatar_unlocked)`, [user.id, id]);
  if (owned.rowCount) return Response.json({ ok: true, alreadyOwned: true, coins: await balanceOf(user.id) });

  const paid = await db.query(
    `update profiles set coins = coins - $2, avatar_unlocked = array_append(avatar_unlocked, $3)
      where user_id=$1 and coins >= $2 and not ($3 = any(avatar_unlocked))
      returning coins, avatar_unlocked as "unlocked"`,
    [user.id, cost, id]);
  if (!paid.rowCount) return Response.json({ error: "not_enough_coins", cost }, { status: 402 });

  await db.query(
    `insert into coin_events (user_id, event_key, amount, reason)
     values ($1,$2,$3,'avatar') on conflict (user_id, event_key) do nothing`,
    [user.id, `avatar:${id}`, -cost]);

  return Response.json({ ok: true, coins: paid.rows[0].coins, unlocked: paid.rows[0].unlocked });
}
