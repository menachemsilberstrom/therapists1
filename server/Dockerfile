# syntax=docker/dockerfile:1
#
# Backend image (Node.js + TypeScript + Express), built for Render but runnable anywhere:
#   docker build -t therapists-api ./server
#   docker run -p 10000:10000 --env-file server/.env -v therapists-uploads:/data therapists-api
#
# Three stages keep the final image small: the compiler and test tools never reach production.
ARG NODE_VERSION=22

# ---- 1. build: install everything and compile TypeScript to plain JavaScript (dist/) ----
FROM node:${NODE_VERSION}-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- 2. production dependencies only (no TypeScript, test tools or pino-pretty) ----
FROM node:${NODE_VERSION}-slim AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---- 3. runtime ----
FROM node:${NODE_VERSION}-slim AS runtime
ENV NODE_ENV=production \
    PORT=10000 \
    # Uploaded avatars and certificates are stored here. Mount a persistent disk at /data, otherwise they are lost
    # whenever the container is replaced (every deploy).
    UPLOADS_DIR=/data/uploads \
    # One reverse proxy (Render's load balancer) sits in front of the app.
    TRUST_PROXY=1
WORKDIR /app

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
# The sed removes Windows line endings, which would make the script fail with "/bin/sh^M: bad interpreter".
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh \
    && chmod +x /usr/local/bin/docker-entrypoint.sh \
    && mkdir -p /data/uploads \
    && chown -R node:node /app /data

EXPOSE 10000

# Docker (and `docker compose`) use this to know the app is really answering; Render uses its own health check path.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# The entrypoint prepares the uploads folder as root, then drops privileges: the app itself never runs as root.
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]
