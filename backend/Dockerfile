FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci --omit=dev

FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci
RUN npx prisma generate
COPY src ./src

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache ffmpeg qpdf tesseract-ocr poppler-utils fontconfig font-dejavu \
  && addgroup -S nodejs && adduser -S nodeuser -G nodejs && mkdir -p /app/logs && chown nodeuser:nodejs /app/logs
# Media edit SVG rasterization (sharp/librsvg/pango) renders text with whatever
# font-family the SVG specifies. Alpine only ships DejaVu, so common web-safe
# family names (Arial, Helvetica, …) resolve to no font and render as boxes —
# alias them to the installed DejaVu faces so edited SVGs never lose glyphs.
RUN mkdir -p /etc/fonts && cat <<'EOF' > /etc/fonts/local.conf
<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <match target="pattern">
    <test name="family"><string>Arial</string></test>
    <edit name="family" mode="assign" binding="strong"><string>DejaVu Sans</string></edit>
  </match>
  <match target="pattern">
    <test name="family"><string>Helvetica</string></test>
    <edit name="family" mode="assign" binding="strong"><string>DejaVu Sans</string></edit>
  </match>
  <match target="pattern">
    <test name="family"><string>Verdana</string></test>
    <edit name="family" mode="assign" binding="strong"><string>DejaVu Sans</string></edit>
  </match>
  <match target="pattern">
    <test name="family"><string>Times New Roman</string></test>
    <edit name="family" mode="assign" binding="strong"><string>DejaVu Serif</string></edit>
  </match>
  <match target="pattern">
    <test name="family"><string>Georgia</string></test>
    <edit name="family" mode="assign" binding="strong"><string>DejaVu Serif</string></edit>
  </match>
  <match target="pattern">
    <test name="family"><string>Courier New</string></test>
    <edit name="family" mode="assign" binding="strong"><string>DejaVu Sans Mono</string></edit>
  </match>
  <alias>
    <family>sans-serif</family>
    <prefer><family>DejaVu Sans</family></prefer>
  </alias>
  <alias>
    <family>serif</family>
    <prefer><family>DejaVu Serif</family></prefer>
  </alias>
  <alias>
    <family>monospace</family>
    <prefer><family>DejaVu Sans Mono</family></prefer>
  </alias>
</fontconfig>
EOF
RUN fc-cache -f
COPY --from=deps --chown=nodeuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodeuser:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nodeuser:nodejs /app/src ./src
COPY --from=builder --chown=nodeuser:nodejs /app/prisma ./prisma
COPY --chown=nodeuser:nodejs package.json ./
COPY --chown=nodeuser:nodejs prisma.config.ts ./
# Ship scripts/ so maintenance ops (reset-admin-password.js, backfills) can run
# via `docker exec` without a separate `docker cp` step.
COPY --chown=nodeuser:nodejs scripts ./scripts
USER nodeuser
EXPOSE 4000
# migrate deploy applies pending SQL migrations (including data-only backfills) before
# the server starts; db push was silently skipping the migrations/ folder.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node src/index.js"]
