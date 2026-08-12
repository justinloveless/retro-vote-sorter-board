# syntax=docker/dockerfile:1
# Cap build parallelism so Coolify deploys stay neighbor-friendly on shared VPS.
FROM node:20-alpine AS builder
WORKDIR /app

ARG BUILD_CPU_LIST=0
ENV BUILD_CPU_LIST=$BUILD_CPU_LIST
ENV GOMAXPROCS=1
ENV RAYON_NUM_THREADS=1
ENV UV_THREADPOOL_SIZE=1
ENV npm_config_maxsockets=2
# Do NOT set NODE_ENV=production before npm ci — that omits devDependencies
# (typescript/tsc) and breaks `npm run build`. Production is set in runtime only.

RUN apk add --no-cache util-linux

COPY package.json package-lock.json* ./
COPY run-cpu-limited.sh /usr/local/bin/run-cpu-limited
RUN chmod +x /usr/local/bin/run-cpu-limited

RUN --mount=type=cache,target=/root/.npm \
  if [ -f package-lock.json ]; then \
    run-cpu-limited npm ci --ignore-scripts; \
  else \
    run-cpu-limited npm install --ignore-scripts; \
  fi

COPY tsconfig.json ./
COPY src ./src
RUN run-cpu-limited npm run build \
  && npm prune --omit=dev

FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV UPLOADS_DIR=/data/uploads

RUN addgroup -S app && adduser -S app -G app \
  && mkdir -p /data/uploads \
  && chown -R app:app /data/uploads /app

COPY --from=builder --chown=app:app /app/package.json ./
COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/dist ./dist

USER app
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/healthz').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
