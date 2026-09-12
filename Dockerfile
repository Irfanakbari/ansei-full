# syntax=docker/dockerfile:1

FROM node:22-bookworm AS build

WORKDIR /workspace

RUN corepack enable && corepack prepare pnpm@10.0.0 --activate

# Install dependencies from the lockfile before copying application sources.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY vendor vendor
RUN pnpm install --frozen-lockfile

COPY apps apps

# Configure the server-only API URL and public browser URLs for the web build.
ARG API_URL
ARG NEXT_PUBLIC_SSO_URL
ARG NEXT_PUBLIC_CALLBACK_AUTH_URL
ENV API_URL=${API_URL}
ENV NEXT_PUBLIC_SSO_URL=${NEXT_PUBLIC_SSO_URL}
ENV NEXT_PUBLIC_CALLBACK_AUTH_URL=${NEXT_PUBLIC_CALLBACK_AUTH_URL}

WORKDIR /workspace/apps/api
RUN pnpm exec prisma generate && pnpm run build

WORKDIR /workspace/apps/web
RUN pnpm run build

# Keep only production dependencies for the combined runtime image.
WORKDIR /workspace
RUN pnpm prune --prod

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV CI=true
ENV LIBREOFFICE_PATH=/usr/bin/soffice

# LibreOffice is required by the API document conversion flow.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       dumb-init \
       libreoffice \
       libreoffice-writer \
       libreoffice-calc \
       libreoffice-impress \
       fonts-dejavu \
       fonts-liberation \
       fontconfig \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/package.json ./package.json
COPY --from=build /workspace/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /workspace/apps/api/package.json ./apps/api/package.json
COPY --from=build /workspace/apps/api/dist ./apps/api/dist
COPY --from=build /workspace/apps/api/prisma ./apps/api/prisma
COPY --from=build /workspace/apps/web/node_modules ./apps/web/node_modules
COPY --from=build /workspace/apps/web/package.json ./apps/web/package.json
COPY --from=build /workspace/apps/web/.next ./apps/web/.next
COPY --from=build /workspace/apps/web/public ./apps/web/public

RUN chown -R node:node /app
USER node

EXPOSE 7500
EXPOSE 3005

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/api/dist/src/main.js"]
