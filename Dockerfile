# ======================
# Builder stage
# ======================
FROM node:22-bookworm AS builder

WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate

# Copy dependency files first (better cache)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json

# Install all deps
RUN pnpm install --frozen-lockfile

# Copy source
COPY apps apps

# Build-time values required by Next.js
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SSO_URL
ARG NEXT_PUBLIC_CALLBACK_AUTH_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_SSO_URL=${NEXT_PUBLIC_SSO_URL}
ENV NEXT_PUBLIC_CALLBACK_AUTH_URL=${NEXT_PUBLIC_CALLBACK_AUTH_URL}

# Generate Prisma Client & Build API
WORKDIR /app/apps/api
RUN pnpm exec prisma generate
RUN pnpm run build

# Build Web (Frontend)
WORKDIR /app/apps/web
RUN pnpm run build

# Clean up devDependencies for production runtime
WORKDIR /app
RUN pnpm prune --prod


# ======================
# Production stage
# ======================
FROM node:22-bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV CI=true

# -------------------------------------------------
# Install LibreOffice and Fonts (API runtime dependency)
# -------------------------------------------------
RUN apt-get update && apt-get install -y \
    libreoffice \
    libreoffice-writer \
    libreoffice-calc \
    libreoffice-impress \
    fonts-dejavu \
    fonts-liberation \
    fontconfig \
    && rm -rf /var/lib/apt/lists/*

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate

# Copy only runtime files (root node_modules and individual apps)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/apps/web/package.json ./apps/web/
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules

# Expose API and Web ports
EXPOSE 7500
EXPOSE 3005

# Optional: make sure soffice is discoverable
ENV LIBREOFFICE_PATH=/usr/bin/soffice

# Default CMD (API by default; overriding the command allows running web or worker)
CMD ["sh", "-c", "cd apps/api && node dist/src/main.js"]
