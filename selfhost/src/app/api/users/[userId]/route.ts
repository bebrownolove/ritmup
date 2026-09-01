import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { currentStreak } from "@/lib/streak";

type Head = {
  id:string; name:string; username:string|null; bio:string; avatarConfig:unknown;
  joinedAt:string; today:string; relationship:"friends"|"incoming"|"outgoing"|"none";
  shareStreak:boolean; shareGoalHits:boolean; shareWorkouts:boolean;
  shareWeight:boolean; shareCalories:boolean; shareSteps:boolean; shareFood:boolean;
};

/**
 * Карточка профиля другого человека.
 *
 * Серию, выполнение цели и тренировки люди открывают всем — это то же, что
 * видно в общем рейтинге. Вес, калории, шаги и еду видят только подтверждённые
 * друзья, и только если человек включил соответствующий переключатель.
 * Скрытое поле возвращается как null, а флаг в `shares` говорит экрану,
 * нарисовать ли на его месте замок вместо числа.
 */
export async function GET(request: Request, context: { params: Promise<{ userId: string }> }) {
  const viewer = await requireUser(request);
  if (!viewer) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { userId } = await context.params;

  const head = await db.query<Head>(
    `select u.id, u.name, u.username, p.avatar_config as "avatarConfig",
            coalesce(p.bio,'') as bio,
            to_char(u."createdAt" at time zone coalesce(p.timezone,'UTC'),'YYYY-MM-DD') as "joinedAt",
            to_char((now() at time zone coalesce(p.timezone,'UTC'))::date,'YYYY-MM-DD') as today,
            coalesce(p.share_streak,true) as "shareStreak",
            coalesce(p.share_goal_hits,true) as "shareGoalHits",
            coalesce(p.share_workouts,true) as "shareWorkouts",
            coalesce(p.share_weight,false) as "shareWeight",
            coalesce(p.share_calories,false) as "shareCalories",
            coalesce(p.share_steps,false) as "shareSteps",
            coalesce(p.share_food,false) as "shareFood",
            case when f.status='accepted' then 'friends'
                 when f.requester_id=$1 then 'outgoing'
                 when f.addressee_id=$1 then 'incoming'
                 else 'none' end as relationship
       from "user" u
       left join profiles p on p.user_id=u.id
       left join friendships f on (f.requester_id=$1 and f.addressee_id=u.id)
         or (f.addressee_id=$1 and f.requester_id=u.id)
      where u.id=$2`, [viewer.id, userId]);

  const person = head.rows[0];
  if (!person) return Response.json({ error: "user_not_found" }, { status: 404 });

  const isSelf = person.id === viewer.id;
  const isFriend = isSelf || person.relationship === "friends";
  const publicly = (flag: boolean) => isSelf || flag;
  const forFriend = (flag: boolean) => isSelf || (isFriend && flag);

  const shares = {
    streak: publicly(person.shareStreak),
    goalHits: publicly(person.shareGoalHits),
    workouts: publicly(person.shareWorkouts),
    weight: forFriend(person.shareWeight),
    calories: forFriend(person.shareCalories),
    steps: forFriend(person.shareSteps),
    food: forFriend(person.shareFood),
  };

  const [streak, counters, day, weight, workoutMinutes, workouts, food, history] = await Promise.all([
    shares.streak ? currentStreak(person.id) : null,
    db.query<{ logged: number; hits: number; tracked: number }>(
      `select count(*) filter (where calories_eaten>0 or weight_kg is not null)::int as logged,
              count(*) filter (where calories_eaten>0 and calories_eaten<=calorie_goal)::int as hits,
              count(*) filter (where calories_eaten>0)::int as tracked
         from daily_logs where user_id=$1 and log_date > $2::date - 30`, [person.id, person.today]),
    shares.calories || shares.steps || shares.workouts || shares.weight
      ? db.query<{ calories: number; goal: number; steps: number | null; activeCalories:number; weightKg:number|null }>(
          `select coalesce(l.calories_eaten,0)::int as calories,
                  coalesce(l.calorie_goal,p.calorie_goal,2000)::int as goal, l.steps,
                  coalesce(l.active_calories,0)::int as "activeCalories", l.weight_kg::float8 as "weightKg"
             from profiles p left join daily_logs l on l.user_id=p.user_id and l.log_date=$2::date
            where p.user_id=$1`, [person.id, person.today])
      : null,
    shares.weight
      ? db.query<{ date: string; weightKg: number }>(
          `select to_char(log_date,'YYYY-MM-DD') as date, weight_kg::float8 as "weightKg"
             from daily_logs where user_id=$1 and weight_kg is not null
            order by log_date desc limit 30`, [person.id])
      : null,
    shares.workouts
      ? db.query<{ total: number }>(
          `select coalesce(sum(minutes),0)::int as total from workouts
            where user_id=$1 and log_date > $2::date - 7`, [person.id, person.today])
      : null,
    shares.workouts
      ? db.query<{ date: string; title: string; minutes: number }>(
          `select to_char(log_date,'YYYY-MM-DD') as date, title, minutes from workouts
            where user_id=$1 order by log_date desc, created_at desc limit 5`, [person.id])
      : null,
    shares.food
      ? db.query<{ title: string; calories: number }>(
          `select title, calories from food_entries
            where user_id=$1 and log_date=$2::date order by created_at`, [person.id, person.today])
      : null,
    // В истории собираем тот же дневник по дням, что человек видит у себя.
    shares.calories || shares.steps || shares.food || shares.workouts || shares.weight
      ? db.query<{ date:string; calories:number; goal:number; steps:number|null; activeCalories:number; weightKg:number|null; food:{title:string;calories:number}[]; workouts:{title:string;minutes:number;calories:number|null}[] }>(
          `select to_char(d.day,'YYYY-MM-DD') as date,
                  coalesce(l.calories_eaten,0)::int as calories,
                  coalesce(l.calorie_goal,p.calorie_goal,2000)::int as goal, l.steps,
                  coalesce(l.active_calories,0)::int as "activeCalories", l.weight_kg::float8 as "weightKg",
                  coalesce(food.items,'[]'::json) as food,
                  coalesce(work.items,'[]'::json) as workouts
             from generate_series(greatest($2::date - 13,$3::date), $2::date, interval '1 day') as d(day)
             cross join profiles p
             left join daily_logs l on l.user_id=p.user_id and l.log_date=d.day
             left join lateral (
               select json_agg(json_build_object('title',e.title,'calories',e.calories) order by e.created_at) as items
                 from food_entries e where e.user_id=$1 and e.log_date=d.day
             ) food on true
             left join lateral (
               select json_agg(json_build_object('title',x.title,'minutes',x.minutes,'calories',x.calories) order by x.created_at) as items
                 from workouts x where x.user_id=$1 and x.log_date=d.day
             ) work on true
            where p.user_id=$1 order by d.day desc`, [person.id, person.today, person.joinedAt])
      : null,
  ] as const);

  const points = weight ? [...weight.rows].reverse() : null;
  const stats = counters.rows[0];

  return Response.json({
    id: person.id,
    name: person.name,
    username: person.username,
    bio: person.bio,
    avatarConfig: person.avatarConfig,
    joinedAt: person.joinedAt,
    relationship: isSelf ? "self" : person.relationship,
    shares,
    streak,
    // Дни с записями — та же информация о регулярности, что и серия, поэтому
    // прячем их за тем же переключателем.
    daysLogged: shares.streak ? stats.logged : null,
    goalHits: shares.goalHits ? { hits: stats.hits, tracked: stats.tracked } : null,
    weight: points?.length
      ? {
          current: points[points.length - 1].weightKg,
          change: points.length > 1 ? points[points.length - 1].weightKg - points[0].weightKg : null,
          points,
        }
      : null,
    today: {
      calories: shares.calories && day ? day.rows[0]?.calories ?? 0 : null,
      goal: shares.calories && day ? day.rows[0]?.goal ?? null : null,
      steps: shares.steps && day ? day.rows[0]?.steps ?? null : null,
      activeCalories: shares.workouts && day ? day.rows[0]?.activeCalories ?? 0 : null,
      weightKg: shares.weight && day ? day.rows[0]?.weightKg ?? null : null,
      // Калории у каждого блюда показываем, только если человек открыл и калории тоже.
      food: food ? food.rows.map(item => ({ title: item.title, calories: shares.calories ? item.calories : null })) : null,
    },
    workoutMinutes: workoutMinutes ? workoutMinutes.rows[0].total : null,
    workouts: workouts ? workouts.rows : null,
    history: history ? history.rows.map(item=>({
      date:item.date,
      calories:shares.calories?item.calories:null,
      goal:shares.calories?item.goal:null,
      steps:shares.steps?item.steps:null,
      activeCalories:shares.workouts?item.activeCalories:null,
      weightKg:shares.weight?item.weightKg:null,
      food:shares.food?item.food.map(entry=>({title:entry.title,calories:shares.calories?entry.calories:null})):null,
      workouts:shares.workouts?item.workouts:null,
    })) : null,
  });
}
