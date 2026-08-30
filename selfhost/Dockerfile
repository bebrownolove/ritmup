FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* вшиваются в клиентский бандл на этапе сборки, а .env исключён
# из контекста (.dockerignore). Поэтому их приходится передавать build-аргументами:
# без этого в браузер уедет undefined.
ARG NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=false
ARG NEXT_PUBLIC_HEALTH_SHORTCUT_URL=
ENV NEXT_TELEMETRY_DISABLED=1     NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=$NEXT_PUBLIC_GOOGLE_AUTH_ENABLED     NEXT_PUBLIC_HEALTH_SHORTCUT_URL=$NEXT_PUBLIC_HEALTH_SHORTCUT_URL
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/migrations ./migrations
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
USER nextjs
EXPOSE 3000
CMD ["sh", "-c", "test -n \"$BETTER_AUTH_SECRET\" && test -n \"$DATABASE_URL\" && node scripts/migrate.mjs && node server.js"]
