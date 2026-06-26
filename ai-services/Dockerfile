FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --legacy-peer-deps

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S nodejs && adduser -S nodeuser -G nodejs
COPY --from=deps --chown=nodeuser:nodejs /app/node_modules ./node_modules
COPY --chown=nodeuser:nodejs src ./src
COPY --chown=nodeuser:nodejs package.json ./
USER nodeuser
EXPOSE 5000
CMD ["node", "src/index.js"]
