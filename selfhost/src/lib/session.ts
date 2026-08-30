import { auth } from "@/lib/auth";

export async function requireUser(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user ?? null;
}
