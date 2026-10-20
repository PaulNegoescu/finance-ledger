FROM node:24-bookworm-slim AS build
RUN npm install -g pnpm@11.25.0
WORKDIR /app
ENV TURBO_TELEMETRY_DISABLED=1
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM node:24-bookworm-slim
RUN npm install -g pnpm@11.25.0
WORKDIR /app
COPY --from=build --chown=node:node /app /app
USER node
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
EXPOSE 3000
CMD ["sh", "-c", "pnpm db:migrate && node apps/web/.output/server/index.mjs"]
