import { requireUser } from "@/lib/session";
import { currentStreak } from "@/lib/streak";

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json({ days: await currentStreak(user.id) });
}
