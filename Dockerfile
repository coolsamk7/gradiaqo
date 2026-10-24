# syntax=docker/dockerfile:1
#
# Production images, built from the whole monorepo (see deploy/README.md):
#   --target api  the API, plus the CLI for migrations (node apps/cli/dist/main.js migration:run)
#   --target web  Caddy with the built web app: serves it, proxies the API and gets HTTPS certificates
#
# Debian rather than Alpine: argon2 (password hashing) is a native module with reliable prebuilt binaries there,
# on x64 and on ARM (Oracle Ampere).

FROM node:22-bookworm-slim AS base
RUN corepack enable
WORKDIR /app

# ---------- Build everything once ----------
FROM base AS build
# Dependencies first, so editing code doesn't reinstall them.
COPY package.json yarn.lock .yarnrc.yml turbo.json ./
COPY apps ./apps
COPY packages ./packages
RUN yarn install --immutable
# Where the browser calls the API: baked into the web app at build time.
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
RUN test -n "$VITE_API_URL" || ( echo "Build arg VITE_API_URL is required, e.g. https://studylog.example.com" && exit 1 )
RUN yarn turbo run build --filter=@studylog/api --filter=@studylog/cli --filter=@studylog/web
# Keep only what the API and CLI need at runtime.
RUN yarn workspaces focus @studylog/api @studylog/cli --production

# ---------- API (and CLI) ----------
FROM base AS api
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=5 \
    CMD node -e "fetch('http://localhost:3000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "apps/api/dist/main"]

# ---------- Web (Caddy) ----------
FROM caddy:2 AS web
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/web/dist /srv/web
