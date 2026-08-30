import { db } from "@/lib/db";

export const COIN_PER_DAY = 10;
export const REPAIR_COST = 50;

/**
 * Монеты за отмеченный день. Ключ события — сам день, поэтому повторные
 * записи за те же сутки не начисляют ничего заново.
 */
export async function awardDay(userId: string, day: string) {
  const inserted = await db.query(
    `insert into coin_events (user_id, event_key, amount, reason)
     values ($1,$2,$3,'day') on conflict (user_id, event_key) do nothing`,
    [userId, `day:${day}`, COIN_PER_DAY]);
  if (inserted.rowCount) {
    await db.query(`update profiles set coins = coins + $2 where user_id=$1`, [userId, COIN_PER_DAY]);
  }
}

export async function balanceOf(userId: string) {
  const result = await db.query<{ coins: number }>(
    `select coins from profiles where user_id=$1`, [userId]);
  return result.rows[0]?.coins ?? 0;
}
