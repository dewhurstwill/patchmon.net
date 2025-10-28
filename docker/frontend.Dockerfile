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

# Install build dependencies for canvas
RUN apk add --no-cache python3 make g++ pkgconfig cairo-dev jpeg-dev pango-dev giflib-dev

WORKDIR /app/frontend

COPY frontend/package*.json ./

RUN echo "=== Starting npm install ===" &&\
    npm cache clean --force &&\
    rm -rf node_modules ~/.npm /root/.npm &&\
    echo "=== npm install with verbose logging ===" &&\
    npm install --legacy-peer-deps --no-audit --prefer-online --fetch-retries=3 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000 --loglevel=verbose &&\
    echo "=== npm install completed ===" &&\
    npm cache clean --force

COPY frontend/ ./

RUN npm run build

# Production stage - use temporary stage to install packages as root, then copy to unprivileged
FROM nginx:alpine AS runtime-builder

# Install runtime dependencies for canvas
RUN apk add --no-cache cairo pango jpeg libpng giflib

# Final production stage - unprivileged
FROM nginxinc/nginx-unprivileged:alpine

# Copy runtime libraries from runtime-builder
COPY --from=runtime-builder /usr/lib/libcairo.so.2 /usr/lib/
COPY --from=runtime-builder /usr/lib/libpango-1.0.so.0 /usr/lib/
COPY --from=runtime-builder /usr/lib/libpangocairo-1.0.so.0 /usr/lib/
COPY --from=runtime-builder /usr/lib/libpangoft2-1.0.so.0 /usr/lib/
COPY --from=runtime-builder /usr/lib/libpng16.so.16 /usr/lib/
COPY --from=runtime-builder /usr/lib/libgif.so.7 /usr/lib/
COPY --from=runtime-builder /usr/lib/libjpeg.so.8 /usr/lib/

ENV BACKEND_HOST=backend \
    BACKEND_PORT=3001

COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
