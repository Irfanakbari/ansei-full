# syntax=docker/dockerfile:1

FROM node:22-bookworm AS dependencies

WORKDIR /workspace

RUN corepack enable && corepack prepare pnpm@10.0.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/label-renderer/package.json apps/label-renderer/package.json
COPY vendor vendor
RUN pnpm install --frozen-lockfile

FROM dependencies AS build
COPY apps apps

WORKDIR /workspace/apps/api
RUN pnpm exec prisma generate && pnpm run build

WORKDIR /workspace/apps/web
RUN pnpm run build

WORKDIR /workspace
RUN mkdir -p /api-runtime/apps/api /api-runtime/apps/label-renderer /api-runtime/vendor \
    && cp package.json pnpm-lock.yaml pnpm-workspace.yaml /api-runtime/ \
    && cp apps/api/package.json /api-runtime/apps/api/package.json \
    && cp apps/label-renderer/package.json /api-runtime/apps/label-renderer/package.json \
    && cp -r apps/label-renderer/src /api-runtime/apps/label-renderer/src \
    && cp vendor/* /api-runtime/vendor/ \
    && cd /api-runtime \
    && pnpm install --prod --frozen-lockfile --filter @ansei/api...

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV CI=true
ENV LIBREOFFICE_PATH=/usr/bin/soffice
ENV ERROR_LOG_STORAGE_PATH=/app/storage/error-logs
ENV PORT=3005
ENV HOSTNAME=0.0.0.0

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       dumb-init \
       libreoffice-writer \
       libreoffice-calc \
       fonts-dejavu-core \
       fonts-liberation \
       fontconfig \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build --chown=node:node /api-runtime/node_modules ./node_modules
COPY --from=build --chown=node:node /api-runtime/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=node:node /api-runtime/apps/label-renderer ./apps/label-renderer
COPY --from=build --chown=node:node /workspace/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=node:node /workspace/apps/api/dist ./apps/api/dist
COPY --from=build --chown=node:node /workspace/apps/api/prisma ./apps/api/prisma
COPY --from=build --chown=node:node /workspace/apps/web/.next/standalone ./web-runtime
COPY --from=build --chown=node:node /workspace/apps/web/.next/static ./web-runtime/apps/web/.next/static
COPY --from=build --chown=node:node /workspace/apps/web/public ./web-runtime/apps/web/public
COPY --chown=node:node start.sh ./start.sh
RUN chmod +x ./start.sh
RUN mkdir -p /app/storage/error-logs \
    && chown -R node:node /app/storage \
    && chmod 700 /app/storage/error-logs \
    && WASM_SRC=$(find /app/node_modules /app/apps/api/node_modules -type d -path "*/@matbee/libreoffice-converter/wasm" 2>/dev/null | head -n 1) \
    && if [ -n "$WASM_SRC" ]; then ln -s "$WASM_SRC" /app/wasm; fi
USER node
VOLUME ["/app/storage/error-logs"]

EXPOSE 7500
EXPOSE 3005

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "const role=process.env.SERVICE_ROLE||'api';const port=process.env.PORT||(role==='web'?'3005':'7500');const path=role==='web'?'/ansei/api/health':'/v1/health';fetch('http://127.0.0.1:'+port+path).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]

ENTRYPOINT ["dumb-init", "--", "./start.sh"]
CMD ["api"]
