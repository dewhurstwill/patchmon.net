# Development target
FROM node:lts-alpine AS development

WORKDIR /app

COPY package*.json ./
COPY frontend/ ./frontend/

RUN npm ci --ignore-scripts

WORKDIR /app/frontend

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]

# Builder stage for production
FROM node:lts-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY frontend/package*.json ./frontend/

RUN npm ci --ignore-scripts

COPY frontend/ ./frontend/

RUN npm run build:frontend

# Production stage
FROM nginxinc/nginx-unprivileged:alpine

ENV BACKEND_HOST=backend \
    BACKEND_PORT=3001

COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
