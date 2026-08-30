import { betterAuth } from "better-auth";
import { username } from "better-auth/plugins";
import { db } from "@/lib/db";

const appUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

export const auth = betterAuth({
  appName: "Ритм",
  baseURL: appUrl,
  secret: process.env.BETTER_AUTH_SECRET ?? "development-only-secret-change-before-production-123456",
  database: db,
  // Приложение доступно и на apex, и на www: оба адреса должны считаться своими,
  // иначе вход с одного из них better-auth отклонит.
  trustedOrigins: Array.from(new Set([appUrl, appUrl.replace("://", "://www.")])),
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
  socialProviders: googleClientId && googleClientSecret ? {
    google: { clientId: googleClientId, clientSecret: googleClientSecret },
  } : undefined,
  plugins: [username({ minUsernameLength: 3, maxUsernameLength: 24 })],
});
