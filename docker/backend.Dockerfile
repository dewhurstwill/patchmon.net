# Development target
FROM node:lts-alpine AS development

ENV NODE_ENV=development \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    ENABLE_LOGGING=true \
    LOG_LEVEL=info \
    PM_LOG_TO_CONSOLE=true \
    PORT=3001

RUN apk add --no-cache openssl tini curl

USER node

WORKDIR /app

COPY --chown=node:node package*.json ./
COPY --chown=node:node backend/ ./backend/
COPY --chown=node:node agents ./agents_backup
COPY --chown=node:node agents ./agents
COPY --chmod=755 docker/backend.docker-entrypoint.sh ./entrypoint.sh

WORKDIR /app/backend

RUN npm ci --ignore-scripts && npx prisma generate

EXPOSE 3001

VOLUME [ "/app/agents" ]

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
  CMD curl -f http://localhost:3001/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["/app/entrypoint.sh"]

# Builder stage for production
FROM node:lts-alpine AS builder

RUN apk add --no-cache openssl

WORKDIR /app

COPY --chown=node:node package*.json ./
COPY --chown=node:node backend/ ./backend/

WORKDIR /app/backend

RUN npm ci --ignore-scripts &&\
    npx prisma generate &&\
    npm prune --omit=dev &&\
    npm cache clean --force

# Production stage
FROM node:lts-alpine

ENV NODE_ENV=production \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    ENABLE_LOGGING=true \
    LOG_LEVEL=info \
    PM_LOG_TO_CONSOLE=true \
    PORT=3001

RUN apk add --no-cache openssl tini curl

USER node

WORKDIR /app

COPY --from=builder /app/backend ./backend
COPY --from=builder /app/node_modules ./node_modules
COPY --chown=node:node agents ./agents_backup
COPY --chown=node:node agents ./agents
COPY --chmod=755 docker/backend.docker-entrypoint.sh ./entrypoint.sh

WORKDIR /app/backend

EXPOSE 3001

VOLUME [ "/app/agents" ]

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
  CMD curl -f http://localhost:3001/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["/app/entrypoint.sh"]
