import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { currentStreak } from "@/lib/streak";

type Row = { id: string; name: string; username: string | null; shareStreak: boolean; shareWorkouts: boolean };

/**
 * Таблица среди друзей. Показываем только то, что человек разрешил показывать:
 * закрытая серия или тренировки просто не попадают в рейтинг.
 */
export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const people = await db.query<Row>(
    `select u.id, u.name, u.username,
            coalesce(p.share_streak,true) as "shareStreak",
            coalesce(p.share_workouts,true) as "shareWorkouts"
       from "user" u left join profiles p on p.user_id=u.id
      where u.id=$1 or exists (
        select 1 from friendships f where f.status='accepted' and
        ((f.requester_id=$1 and f.addressee_id=u.id) or (f.addressee_id=$1 and f.requester_id=u.id)))`,
    [user.id]);

  const rows = await Promise.all(people.rows.map(async person => {
    const isSelf = person.id === user.id;
    const minutes = await db.query<{ total: number }>(
      `select coalesce(sum(minutes),0)::int as total from workouts
        where user_id=$1 and log_date >= current_date - 6`, [person.id]);
    return {
      id: person.id,
      name: person.name,
      username: person.username,
      isSelf,
      streak: isSelf || person.shareStreak ? await currentStreak(person.id) : null,
      workoutMinutes: isSelf || person.shareWorkouts ? minutes.rows[0].total : null,
    };
  }));

  rows.sort((a, b) => (b.streak ?? -1) - (a.streak ?? -1) || (b.workoutMinutes ?? -1) - (a.workoutMinutes ?? -1));
  return Response.json(rows);
}
