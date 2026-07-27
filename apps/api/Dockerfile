# Dockerfile — Counsel API (Express + Prisma)
FROM node:22-slim

WORKDIR /app

# PNPM for monorepo
RUN npm install -g pnpm@9

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/database/package.json packages/database/
COPY apps/api/package.json apps/api/

RUN pnpm install --frozen-lockfile

COPY . .

RUN npx prisma generate --schema=packages/database/prisma/schema.prisma

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://127.0.0.1:3001/api/health || exit 1

CMD ["node", "apps/api/scripts/start-api.mjs"]
