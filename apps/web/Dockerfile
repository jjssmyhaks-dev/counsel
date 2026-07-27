# Dockerfile — Counsel Web (Next.js 15)
FROM node:22-slim

WORKDIR /app

RUN npm install -g pnpm@9

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/database/package.json packages/database/
COPY apps/web/package.json apps/web/

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter counsel-platform-web build

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://127.0.0.1:3000 || exit 1

CMD ["pnpm", "--filter", "counsel-platform-web", "start"]
