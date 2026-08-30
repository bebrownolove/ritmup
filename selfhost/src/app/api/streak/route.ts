import { requireUser } from "@/lib/session";
import { currentStreak } from "@/lib/streak";
import { balanceOf } from "@/lib/coins";

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json({ days: await currentStreak(user.id), coins: await balanceOf(user.id) });
}
