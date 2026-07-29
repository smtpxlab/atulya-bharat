# syntax=docker/dockerfile:1.7
# Single-service image for Railway: builds the Vite frontend (site + admin)
# and the Express API, then runs ONE process that serves both.

# ---------- 1. Frontend build ----------
FROM node:20-alpine AS client
WORKDIR /client

COPY package.json package-lock.json* bun.lockb* ./
RUN --mount=type=cache,id=npm,target=/root/.npm npm install --no-audit --no-fund

COPY . .
# Vite inlines VITE_* at build time — they must be Railway *build* variables.
ARG VITE_BACKEND_ENABLED=true
ARG VITE_BACKEND_URL=""
ARG VITE_BACKEND_API_PREFIX=/api/v1
ARG VITE_SUPABASE_URL=""
ARG VITE_SUPABASE_PUBLISHABLE_KEY=""
ARG VITE_SUPABASE_PROJECT_ID=""
ENV VITE_BACKEND_ENABLED=$VITE_BACKEND_ENABLED \
    VITE_BACKEND_URL=$VITE_BACKEND_URL \
    VITE_BACKEND_API_PREFIX=$VITE_BACKEND_API_PREFIX \
    VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY \
    VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID
RUN npm run build

# ---------- 2. Server build ----------
FROM node:20-alpine AS server
WORKDIR /app
COPY server/package.json server/package-lock.json* ./
RUN --mount=type=cache,id=npm,target=/root/.npm npm install --no-audit --no-fund
COPY server/tsconfig.json ./
COPY server/src ./src
RUN npm run build

# ---------- 3. Runtime ----------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8000
ENV SERVE_CLIENT=true
ENV CLIENT_DIST_DIR=client

RUN apk add --no-cache tini

COPY server/package.json server/package-lock.json* ./
RUN --mount=type=cache,id=npm,target=/root/.npm npm install --omit=dev --no-audit --no-fund

COPY --from=server /app/dist ./dist
COPY server/knexfile.ts ./knexfile.ts
COPY server/src/models ./src/models
COPY --from=client /client/dist ./client

EXPOSE 8000
USER node
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/api/v1/health || exit 1
