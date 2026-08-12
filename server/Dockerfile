# syntax=docker/dockerfile:1
# Cap build parallelism so Coolify deploys stay neighbor-friendly on shared VPS.
FROM node:20-alpine AS builder
WORKDIR /app

ENV GOMAXPROCS=1
ENV UV_THREADPOOL_SIZE=2
ENV npm_config_maxsockets=2
# Do NOT set NODE_ENV=production before npm ci — that omits devDependencies
# (typescript/tsc) and breaks `npm run build`. Production is set in runtime only.

COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
  if [ -f package-lock.json ]; then npm ci --ignore-scripts; else npm install --ignore-scripts; fi

COPY tsconfig.json ./
COPY src ./src
RUN nice -n 10 npm run build \
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
