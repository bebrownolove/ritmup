import { db } from "@/lib/db";

export async function GET() {
  try {
    await db.query("select 1");
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "degraded" }, { status: 503 });
  }
}
