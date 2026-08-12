# syntax=docker/dockerfile:1
# Coolify / shared VPS: runtime `deploy.resources.limits` do NOT apply during image
# builds. Cap Node heap + pin the Vite build to one CPU so deploys cannot freeze the host.
FROM node:20-alpine AS builder
WORKDIR /app

# Atlaskit Vite build needs ~3GB; 8192 thrash-freezes small Hetzner/Coolify hosts.
ARG BUILD_MAX_OLD_SPACE_SIZE=3072
# Comma-separated CPU list for taskset (default: core 0 only).
ARG BUILD_CPU_LIST=0
ENV BUILD_MAX_OLD_SPACE_SIZE=$BUILD_MAX_OLD_SPACE_SIZE
ENV BUILD_CPU_LIST=$BUILD_CPU_LIST
ENV NODE_OPTIONS=--max-old-space-size=${BUILD_MAX_OLD_SPACE_SIZE}
# esbuild (Go) + SWC (Rayon) + libuv — keep worker pools tiny; taskset enforces the hard cap.
ENV GOMAXPROCS=1
ENV RAYON_NUM_THREADS=1
ENV UV_THREADPOOL_SIZE=1
ENV npm_config_maxsockets=2
ENV npm_config_fetch_retries=2
# Warning-only; browserslist does not auto-update. Silence noisy Coolify logs.
ENV BROWSERSLIST_IGNORE_OLD_DATA=1

RUN apk add --no-cache util-linux

# .npmrc sets legacy-peer-deps=true (required for Atlaskit/react-intl peer graph).
COPY package.json package-lock.json .npmrc ./
COPY scripts/run-cpu-limited.sh ./scripts/run-cpu-limited.sh
RUN chmod +x ./scripts/run-cpu-limited.sh

# Skip postinstall during ci — prebuild (via npm run build) packs the advisor zip once.
RUN --mount=type=cache,target=/root/.npm \
  ./scripts/run-cpu-limited.sh npm ci --ignore-scripts

COPY . .
RUN chmod +x ./scripts/run-cpu-limited.sh

# Vite env vars are build-time — Coolify must rebuild web when these change.
ARG VITE_API_BASE_URL=
ARG VITE_SUPABASE_URL=
ARG VITE_SUPABASE_PUBLISHABLE_KEY=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY

# Step 6/6: Atlaskit vite build — must be CPU-pinned (nice alone is not enough).
RUN ./scripts/run-cpu-limited.sh npm run build


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
