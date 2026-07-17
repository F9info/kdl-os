FROM node:22-alpine AS deps
WORKDIR /app
RUN npm install -g pnpm@11.1.2
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --no-frozen-lockfile --config.dangerously-allow-all-builds=true

FROM node:22-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm@11.1.2
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* and rewrites() are baked at build time, and .env.local is .dockerignored,
# so set them here. Same-origin /api keeps the auth cookie first-party; next.config.ts
# rewrites proxy /api to the backend over the internal Docker network.
ARG NEXT_PUBLIC_API_URL=/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ARG BACKEND_INTERNAL_URL=http://backend:4000
ENV BACKEND_INTERNAL_URL=$BACKEND_INTERNAL_URL
RUN pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
