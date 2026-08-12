# syntax=docker/dockerfile:1
# Coolify / shared VPS: runtime `deploy.resources.limits` do NOT apply during image
# builds. Cap Node heap + Go/esbuild threads so deploys cannot freeze the host.
FROM node:20-alpine AS builder
WORKDIR /app

# Atlaskit Vite build needs ~3GB; 8192 thrash-freezes small Hetzner/Coolify hosts.
ARG BUILD_MAX_OLD_SPACE_SIZE=3072
ENV BUILD_MAX_OLD_SPACE_SIZE=$BUILD_MAX_OLD_SPACE_SIZE
ENV NODE_OPTIONS=--max-old-space-size=${BUILD_MAX_OLD_SPACE_SIZE}
# esbuild is Go-based; keep the host schedulable while Coolify builds.
ENV GOMAXPROCS=1
ENV UV_THREADPOOL_SIZE=2
ENV npm_config_maxsockets=2
ENV npm_config_fetch_retries=2

# .npmrc sets legacy-peer-deps=true (required for Atlaskit/react-intl peer graph).
COPY package.json package-lock.json .npmrc ./
# Skip postinstall during ci — prebuild (via npm run build) packs the advisor zip once.
RUN --mount=type=cache,target=/root/.npm \
  npm ci --ignore-scripts

COPY . .

# Vite env vars are build-time — Coolify must rebuild web when these change.
ARG VITE_API_BASE_URL=
ARG VITE_SUPABASE_URL=
ARG VITE_SUPABASE_PUBLISHABLE_KEY=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY

RUN nice -n 10 npm run build


FROM nginx:stable-alpine
WORKDIR /usr/share/nginx/html
RUN apk add --no-cache curl \
  && chown -R nginx:nginx /var/cache/nginx \
  && mkdir -p /run && chown -R nginx:nginx /run
COPY --from=builder /app/dist .
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
USER nginx
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -fsS http://127.0.0.1/ >/dev/null || exit 1
CMD ["nginx", "-g", "daemon off;"]
