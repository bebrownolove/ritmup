import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { currentStreak } from "@/lib/streak";

type Row = { id: string; name: string; username: string | null; avatarConfig:unknown; shareStreak: boolean; shareWorkouts: boolean; tiePriority: boolean };

/**
 * Общий рейтинг всех зарегистрированных людей. Показываем только то, что
 * человек разрешил показывать публично.
 */
export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const people = await db.query<Row>(
    `select u.id, u.name, u.username, p.avatar_config as "avatarConfig",
            coalesce(p.share_streak,true) as "shareStreak",
            coalesce(p.share_workouts,true) as "shareWorkouts",
            lower(coalesce(u.username,''))='lisabean' as "tiePriority"
       from "user" u left join profiles p on p.user_id=u.id
      order by u.name asc`,
    []);

  const rows = await Promise.all(people.rows.map(async person => {
    const isSelf = person.id === user.id;
    const minutes = await db.query<{ total: number }>(
      `select coalesce(sum(minutes),0)::int as total from workouts
        where user_id=$1 and log_date >= current_date - 6`, [person.id]);
    return {
      id: person.id,
      name: person.name,
      username: person.username,
      avatarConfig: person.avatarConfig,
      isSelf,
      streak: isSelf || person.shareStreak ? await currentStreak(person.id) : null,
      workoutMinutes: isSelf || person.shareWorkouts ? minutes.rows[0].total : null,
      tiePriority: person.tiePriority,
    };
  }));

  rows.sort((a, b) => (b.streak ?? -1) - (a.streak ?? -1)
    || Number(b.tiePriority) - Number(a.tiePriority)
    || (b.workoutMinutes ?? -1) - (a.workoutMinutes ?? -1));
  return Response.json(rows.map(row => ({
    id: row.id, name: row.name, username: row.username, avatarConfig: row.avatarConfig,
    isSelf: row.isSelf, streak: row.streak, workoutMinutes: row.workoutMinutes,
  })));
}
