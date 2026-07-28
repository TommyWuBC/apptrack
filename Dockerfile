# Multi-stage build. Targets: server | worker
FROM node:22-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* turbo.json tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
RUN pnpm install --frozen-lockfile || pnpm install

FROM deps AS build
RUN pnpm build

FROM node:22-bookworm-slim AS server
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
RUN chmod +x /app/scripts/docker-entrypoint-server.sh
EXPOSE 3000
CMD ["/app/scripts/docker-entrypoint-server.sh"]

FROM node:22-bookworm-slim AS worker
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
CMD ["node", "apps/worker/dist/index.js"]
